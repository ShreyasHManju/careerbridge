from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.experience_record import (
    ExperienceRecordCreate,
    ExperienceRecordListResponse,
    ExperienceRecordResponse,
    ExperienceRecordUpdate,
    ExperienceVerificationDecision,
)
from app.services.experience_record_service import ExperienceRecordService

router = APIRouter(tags=["Verified Experience"])


# ============================================================================
# STUDENT OWNED EXPERIENCE ENDPOINTS (/students/me/experiences)
# ============================================================================

@router.get(
    "/students/me/experiences",
    response_model=ExperienceRecordListResponse,
    summary="List authenticated student's experience records",
    description="Retrieves all experience records (claimed, draft, pending, verified, rejected) created by the authenticated student.",
)
def get_my_experiences(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve all experience records for the currently authenticated student.
    """
    return ExperienceRecordService.list_student_experiences(
        db=db,
        student_id=current_user.id,
    )


@router.post(
    "/students/me/experiences",
    response_model=ExperienceRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new student experience record",
    description="Allows an authenticated student to add a discrete experience claim (project, internship, work, etc.).",
)
def create_my_experience(
    payload: ExperienceRecordCreate,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Create a new experience record. Automatically sets ownership to current student.
    """
    return ExperienceRecordService.create_experience(
        db=db,
        student_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/students/me/experiences/{experience_id}",
    response_model=ExperienceRecordResponse,
    summary="Get single owned experience record",
    description="Retrieve details of an experience record owned by the authenticated student.",
)
def get_my_experience_by_id(
    experience_id: int = Path(..., ge=1, description="Primary key of the experience record"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve single experience record for the authenticated student.
    """
    return ExperienceRecordService.get_experience(
        db=db,
        experience_id=experience_id,
        current_user=current_user,
    )


@router.patch(
    "/students/me/experiences/{experience_id}",
    response_model=ExperienceRecordResponse,
    summary="Update an owned experience record",
    description="Allows a student to partially update their experience record. Enforces verified record immutability.",
)
def update_my_experience(
    experience_id: int = Path(..., ge=1, description="Primary key of the experience record"),
    payload: ExperienceRecordUpdate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Update experience fields. Enforces student ownership and immutability guards on core verified fields.
    """
    return ExperienceRecordService.update_experience(
        db=db,
        experience_id=experience_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/students/me/experiences/{experience_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an owned experience record",
    description="Deletes an experience record owned by the authenticated student.",
)
def delete_my_experience(
    experience_id: int = Path(..., ge=1, description="Primary key of the experience record"),
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Delete experience record. Enforces ownership check.
    """
    is_admin = current_user.role == UserRole.ADMIN
    ExperienceRecordService.delete_experience(
        db=db,
        experience_id=experience_id,
        student_id=current_user.id,
        is_admin=is_admin,
    )
    return None


@router.post(
    "/students/me/experiences/{experience_id}/request-verification",
    response_model=ExperienceRecordResponse,
    summary="Request verification for an experience record",
    description="Submits an experience record to the verification queue for recruiter or admin review.",
)
def request_experience_verification(
    experience_id: int = Path(..., ge=1, description="Primary key of the experience record"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Transition experience record to pending_verification status.
    """
    return ExperienceRecordService.request_verification(
        db=db,
        experience_id=experience_id,
        student_id=current_user.id,
    )


# ============================================================================
# VERIFICATION QUEUE & DECISION ENDPOINTS (/verifications)
# ============================================================================

@router.get(
    "/verifications/pending",
    response_model=ExperienceRecordListResponse,
    summary="List pending verification requests",
    description="Lists pending verification requests for authorized recruiters (scoped to company) or platform administrators.",
)
def list_pending_verifications(
    current_user: User = Depends(require_role(UserRole.RECRUITER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Retrieve verification requests awaiting decision.
    """
    return ExperienceRecordService.list_pending_verifications(
        db=db,
        current_user=current_user,
    )


@router.post(
    "/verifications/{experience_id}/decision",
    response_model=ExperienceRecordResponse,
    summary="Approve or reject a pending verification request",
    description="Allows authorized recruiters or administrators to decide on a pending verification claim with optional audit notes.",
)
def decide_verification(
    experience_id: int = Path(..., ge=1, description="Primary key of the experience record"),
    payload: ExperienceVerificationDecision = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Process verification approval or rejection. Prevents student self-verification.
    """
    return ExperienceRecordService.decide_verification(
        db=db,
        experience_id=experience_id,
        verifier=current_user,
        decision=payload,
    )


# ============================================================================
# PUBLIC / RECRUITER STUDENT EXPERIENCE READ (/students/{user_id}/experiences)
# ============================================================================

@router.get(
    "/students/{user_id}/experiences",
    response_model=ExperienceRecordListResponse,
    summary="List verified experiences for a student profile",
    description="Public and recruiter view of student experiences. Only returns verified records unless caller is the student owner or admin.",
)
def list_student_public_experiences(
    user_id: int = Path(..., ge=1, description="User ID of the student"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve verified experience records for a given student profile.
    """
    return ExperienceRecordService.list_public_student_experiences(
        db=db,
        target_student_id=user_id,
        current_user=current_user,
    )
