from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.core.deps import require_role
from app.models.skill import StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.student_profile import (
    StudentProfileCreate,
    StudentProfileResponse,
    StudentProfileUpdate,
)
from app.services.skill_service import sync_student_skills_from_text

router = APIRouter(prefix="/student/profile", tags=["Student Profile"])


@router.get(
    "",
    response_model=StudentProfileResponse,
    summary="Get current student profile",
    description="Retrieve profile details for the authenticated student. Protected by student-only RBAC.",
)
@router.get("/", response_model=StudentProfileResponse, include_in_schema=False)
def get_student_profile(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve current student's profile.
    Ownership is strictly bound to current_user.id from the verified JWT.
    """
    profile = db.scalar(
        select(StudentProfile)
        .options(selectinload(StudentProfile.student_skills).joinedload(StudentSkill.skill))
        .where(StudentProfile.user_id == current_user.id)
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found",
        )
    return profile


@router.post(
    "",
    response_model=StudentProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create student profile",
    description="Create a new profile for the authenticated student. User ID is securely derived from JWT credentials.",
)
@router.post(
    "/",
    response_model=StudentProfileResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_student_profile(
    payload: StudentProfileCreate,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Create a new profile for the authenticated student.
    Enforces:
    - 1-to-1 relationship: Returns 409 Conflict if profile already exists.
    - Ownership security: user_id is set to current_user.id, ignoring any client-provided IDs.
    - Structured skill synchronization with legacy string preservation.
    """
    existing = db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student profile already exists for this account",
        )

    profile_data = payload.model_dump()
    raw_skills = profile_data.pop("skills", None)
    new_profile = StudentProfile(
        user_id=current_user.id,
        **profile_data,
    )
    db.add(new_profile)
    db.flush()
    sync_student_skills_from_text(db, new_profile, raw_skills)
    db.commit()
    db.refresh(new_profile)
    return new_profile


@router.patch(
    "",
    response_model=StudentProfileResponse,
    summary="Update student profile",
    description="Partially update the authenticated student's profile. User ID cannot be modified.",
)
@router.patch("/", response_model=StudentProfileResponse, include_in_schema=False)
def update_student_profile(
    payload: StudentProfileUpdate,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Partially update existing student profile fields.
    Enforces:
    - Returns 404 if profile does not exist.
    - Only unset fields are skipped; ownership (user_id) cannot be modified.
    - Synchronizes structured skills whenever skills field is updated.
    """
    profile = db.scalar(
        select(StudentProfile)
        .options(selectinload(StudentProfile.student_skills).joinedload(StudentSkill.skill))
        .where(StudentProfile.user_id == current_user.id)
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    # Explicitly defend against any user_id alteration attempt
    update_data.pop("user_id", None)
    has_skills_update = "skills" in payload.model_fields_set
    raw_skills = update_data.pop("skills", None)

    for field, value in update_data.items():
        setattr(profile, field, value)

    if has_skills_update:
        sync_student_skills_from_text(db, profile, raw_skills)

    db.commit()
    db.refresh(profile)
    return profile
