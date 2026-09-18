from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.storage import delete_stored_file, save_resume_file
from app.models.resume import Resume
from app.models.user import User, UserRole
from app.schemas.resume import ResumeResponse

router = APIRouter(prefix="/resume", tags=["Resume & Documents"])


@router.post(
    "",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload or replace current student's resume",
    description=(
        "Allows an authenticated student to upload or update their resume document. "
        "Accepts PDF, DOC, and DOCX formats up to configured size limit (5MB). "
        "Derives ownership strictly from current_user.id. Replaces any existing resume safely."
    ),
)
@router.post(
    "/",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume document file (PDF, DOC, or DOCX)"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Upload or replace resume:
    1. Validates extension, MIME type, magic bytes, and file size in chunks.
    2. Streams file to secure UUID-based path.
    3. If existing resume exists, updates metadata and deletes old physical file.
    4. Otherwise creates new Resume record.
    """
    # Look up existing resume for this student
    existing_resume = db.scalar(
        select(Resume).where(Resume.student_id == current_user.id)
    )

    # Save new file first before altering database
    stored_filename, file_path_str, file_size = await save_resume_file(file)

    if existing_resume:
        old_file_path = existing_resume.file_path

        # Update metadata to point to newly stored file
        existing_resume.original_filename = file.filename or "resume.pdf"
        existing_resume.stored_filename = stored_filename
        existing_resume.file_path = file_path_str
        existing_resume.content_type = file.content_type or "application/octet-stream"
        existing_resume.file_size = file_size

        db.commit()
        db.refresh(existing_resume)

        # Remove old physical file only after database commit succeeds
        if old_file_path != file_path_str:
            delete_stored_file(old_file_path)

        return existing_resume

    new_resume = Resume(
        student_id=current_user.id,
        original_filename=file.filename or "resume.pdf",
        stored_filename=stored_filename,
        file_path=file_path_str,
        content_type=file.content_type or "application/octet-stream",
        file_size=file_size,
    )
    db.add(new_resume)
    db.commit()
    db.refresh(new_resume)
    return new_resume


@router.get(
    "",
    response_model=ResumeResponse,
    summary="Get current student's resume metadata",
    description="Retrieves metadata for the authenticated student's uploaded resume.",
)
@router.get("/", response_model=ResumeResponse, include_in_schema=False)
def get_my_resume(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve resume metadata for authenticated student.
    Returns 404 if no resume has been uploaded yet.
    """
    resume = db.scalar(
        select(Resume).where(Resume.student_id == current_user.id)
    )
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    return resume


@router.get(
    "/download",
    summary="Download current student's resume document",
    description="Downloads the physical resume document for the authenticated student.",
)
def download_my_resume(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Download physical resume file.
    Enforces student ownership and verifies file presence on disk.
    """
    resume = db.scalar(
        select(Resume).where(Resume.student_id == current_user.id)
    )
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    file_path = Path(resume.file_path)
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume file not found on disk",
        )

    return FileResponse(
        path=str(file_path),
        media_type=resume.content_type,
        filename=resume.original_filename,
    )


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete current student's resume",
    description="Deletes the authenticated student's resume document and database record.",
)
@router.delete("/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_my_resume(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Delete resume:
    1. Locates student's resume record (404 if missing).
    2. Deletes physical file.
    3. Deletes database record.
    """
    resume = db.scalar(
        select(Resume).where(Resume.student_id == current_user.id)
    )
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    # Delete physical file
    delete_stored_file(resume.file_path)

    # Delete DB record
    db.delete(resume)
    db.commit()
    return None
