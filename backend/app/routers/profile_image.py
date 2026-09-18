from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.storage import delete_stored_file, save_profile_image_file
from app.models.profile_image import ProfileImage
from app.models.user import User, UserRole
from app.schemas.profile_image import ProfileImageResponse

router = APIRouter(prefix="/profile-image", tags=["Profile Image"])


@router.post(
    "",
    response_model=ProfileImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload or replace current student's profile image",
    description=(
        "Allows an authenticated student to upload or update their profile image. "
        "Accepts JPEG, PNG, and WebP formats up to configured size limit (2MB). "
        "Derives ownership strictly from current_user.id. Replaces any existing profile image safely."
    ),
)
@router.post(
    "/",
    response_model=ProfileImageResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def upload_profile_image(
    file: UploadFile = File(..., description="Profile image file (JPEG, PNG, or WebP)"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Upload or replace profile image:
    1. Validates extension, MIME type, magic bytes, and file size in chunks.
    2. Streams file to secure UUID-based path.
    3. If an existing profile image exists, updates metadata and deletes old physical file.
    4. Otherwise creates new ProfileImage record.
    """
    # Look up existing profile image for this student
    existing_image = db.scalar(
        select(ProfileImage).where(ProfileImage.student_id == current_user.id)
    )

    # Save new file first before altering database
    stored_filename, file_path_str, file_size = await save_profile_image_file(file)

    if existing_image:
        old_file_path = existing_image.file_path

        # Update metadata to point to newly stored file
        existing_image.original_filename = file.filename or "profile_image.jpg"
        existing_image.stored_filename = stored_filename
        existing_image.file_path = file_path_str
        existing_image.content_type = file.content_type or "image/jpeg"
        existing_image.file_size = file_size

        db.commit()
        db.refresh(existing_image)

        # Remove old physical file only after database commit succeeds
        if old_file_path != file_path_str:
            delete_stored_file(old_file_path)

        return existing_image

    new_image = ProfileImage(
        student_id=current_user.id,
        original_filename=file.filename or "profile_image.jpg",
        stored_filename=stored_filename,
        file_path=file_path_str,
        content_type=file.content_type or "image/jpeg",
        file_size=file_size,
    )
    db.add(new_image)
    db.commit()
    db.refresh(new_image)
    return new_image


@router.get(
    "",
    response_model=ProfileImageResponse,
    summary="Get current student's profile image metadata",
    description="Retrieves metadata for the authenticated student's uploaded profile image.",
)
@router.get("/", response_model=ProfileImageResponse, include_in_schema=False)
def get_my_profile_image(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve profile image metadata for authenticated student.
    Returns 404 if no profile image has been uploaded yet.
    """
    image = db.scalar(
        select(ProfileImage).where(ProfileImage.student_id == current_user.id)
    )
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found",
        )
    return image


@router.get(
    "/download",
    summary="Download current student's profile image",
    description="Downloads the physical profile image file for the authenticated student.",
)
def download_my_profile_image(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Download physical profile image file.
    Enforces student ownership and verifies file presence on disk.
    """
    image = db.scalar(
        select(ProfileImage).where(ProfileImage.student_id == current_user.id)
    )
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found",
        )

    file_path = Path(image.file_path)
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image file not found on disk",
        )

    return FileResponse(
        path=str(file_path),
        media_type=image.content_type,
        filename=image.original_filename,
    )


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete current student's profile image",
    description="Deletes the authenticated student's profile image and database record.",
)
@router.delete("/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_my_profile_image(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Delete profile image:
    1. Locates student's profile image record (404 if missing).
    2. Deletes physical file.
    3. Deletes database record.
    """
    image = db.scalar(
        select(ProfileImage).where(ProfileImage.student_id == current_user.id)
    )
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found",
        )

    # Delete physical file
    delete_stored_file(image.file_path)

    # Delete DB record
    db.delete(image)
    db.commit()
    return None
