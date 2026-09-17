from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole
from app.schemas.recruiter_profile import (
    RecruiterProfileCreate,
    RecruiterProfileResponse,
    RecruiterProfileUpdate,
)

router = APIRouter(prefix="/recruiter/profile", tags=["Recruiter Profile"])


@router.get(
    "",
    response_model=RecruiterProfileResponse,
    summary="Get current recruiter profile",
    description="Retrieve profile details for the authenticated recruiter. Protected by recruiter-only RBAC.",
)
@router.get("/", response_model=RecruiterProfileResponse, include_in_schema=False)
def get_recruiter_profile(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Retrieve current recruiter's profile.
    Ownership is strictly bound to current_user.id from the verified JWT.
    """
    profile = db.scalar(
        select(RecruiterProfile).where(RecruiterProfile.user_id == current_user.id)
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found",
        )
    return profile


@router.post(
    "",
    response_model=RecruiterProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create recruiter profile",
    description="Create a new profile for the authenticated recruiter. User ID is securely derived from JWT credentials.",
)
@router.post(
    "/",
    response_model=RecruiterProfileResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_recruiter_profile(
    payload: RecruiterProfileCreate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Create a new profile for the authenticated recruiter.
    Enforces:
    - 1-to-1 relationship: Returns 409 Conflict if profile already exists.
    - Ownership security: user_id is set to current_user.id, ignoring any client-provided IDs.
    """
    existing = db.scalar(
        select(RecruiterProfile).where(RecruiterProfile.user_id == current_user.id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recruiter profile already exists for this account",
        )

    profile_data = payload.model_dump()
    new_profile = RecruiterProfile(
        user_id=current_user.id,
        **profile_data,
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile


@router.patch(
    "",
    response_model=RecruiterProfileResponse,
    summary="Update recruiter profile",
    description="Partially update the authenticated recruiter's profile. User ID cannot be modified.",
)
@router.patch("/", response_model=RecruiterProfileResponse, include_in_schema=False)
def update_recruiter_profile(
    payload: RecruiterProfileUpdate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Partially update existing recruiter profile fields.
    Enforces:
    - Returns 404 if profile does not exist.
    - Only unset fields are skipped; ownership (user_id) cannot be modified.
    """
    profile = db.scalar(
        select(RecruiterProfile).where(RecruiterProfile.user_id == current_user.id)
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    # Explicitly defend against any user_id alteration attempt
    update_data.pop("user_id", None)

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile
