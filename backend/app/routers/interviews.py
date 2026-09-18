from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.application import Application
from app.models.interview import Interview
from app.models.user import User, UserRole
from app.schemas.interview import (
    InterviewCreate,
    InterviewResponse,
    InterviewUpdate,
)
from app.services.interview_service import InterviewService

router = APIRouter(tags=["Interviews"])


# --------------------------------------------------------------------------
# Create Interview
# --------------------------------------------------------------------------
@router.post(
    "/applications/{application_id}/interviews",
    response_model=InterviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule an interview for an application",
    description="Allows a hiring recruiter to schedule an interview for a candidate application on an active job posting.",
)
def schedule_interview(
    application_id: int,
    payload: InterviewCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    interview = InterviewService.create_interview(
        db,
        application_id=application_id,
        recruiter_id=current_user.id,
        payload=payload,
        background_tasks=background_tasks,
    )
    return InterviewResponse.from_interview(interview)



# --------------------------------------------------------------------------
# Student Interview List
# --------------------------------------------------------------------------
@router.get(
    "/interviews/me",
    response_model=List[InterviewResponse],
    status_code=status.HTTP_200_OK,
    summary="List interviews scheduled for current student",
    description="Retrieves all scheduled, rescheduled, completed, and cancelled interviews for the authenticated student, sorted chronologically.",
)
def get_my_interviews(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Interview)
        .options(
            joinedload(Interview.application).joinedload(Application.job_posting),
            joinedload(Interview.recruiter),
            joinedload(Interview.student),
        )
        .where(Interview.student_id == current_user.id)
        .order_by(Interview.scheduled_at.asc(), Interview.id.asc())
    )
    interviews = db.scalars(stmt).all()
    return [InterviewResponse.from_interview(i) for i in interviews]


# --------------------------------------------------------------------------
# Recruiter Interview List
# --------------------------------------------------------------------------
@router.get(
    "/recruiter/interviews",
    response_model=List[InterviewResponse],
    status_code=status.HTTP_200_OK,
    summary="List interviews scheduled by current recruiter",
    description="Retrieves all interviews scheduled by the authenticated recruiter across their job postings, sorted chronologically.",
)
def get_recruiter_interviews(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Interview)
        .options(
            joinedload(Interview.application).joinedload(Application.job_posting),
            joinedload(Interview.recruiter),
            joinedload(Interview.student),
        )
        .where(Interview.recruiter_id == current_user.id)
        .order_by(Interview.scheduled_at.asc(), Interview.id.asc())
    )
    interviews = db.scalars(stmt).all()
    return [InterviewResponse.from_interview(i) for i in interviews]


# --------------------------------------------------------------------------
# Get Single Interview Detail
# --------------------------------------------------------------------------
@router.get(
    "/interviews/{interview_id}",
    response_model=InterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single interview detail",
    description="Retrieves interview details. Accessible by the participating student, hiring recruiter, or administrator.",
)
def get_interview_detail(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Interview)
        .options(
            joinedload(Interview.application).joinedload(Application.job_posting),
            joinedload(Interview.recruiter),
            joinedload(Interview.student),
        )
        .where(Interview.id == interview_id)
    )
    interview = db.scalar(stmt)
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    # Role & Ownership checks
    if current_user.role == UserRole.STUDENT and interview.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this interview",
        )
    elif current_user.role == UserRole.RECRUITER and interview.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this interview",
        )

    return InterviewResponse.from_interview(interview)


# --------------------------------------------------------------------------
# Update / Reschedule Interview
# --------------------------------------------------------------------------
@router.patch(
    "/interviews/{interview_id}",
    response_model=InterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Update or reschedule an interview",
    description="Allows the hiring recruiter to update interview parameters or reschedule timing while enforcing conflict protection.",
)
def update_interview(
    interview_id: int,
    payload: InterviewUpdate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    interview = InterviewService.update_interview(
        db,
        interview_id=interview_id,
        recruiter_id=current_user.id,
        payload=payload,
    )
    return InterviewResponse.from_interview(interview)


# --------------------------------------------------------------------------
# Cancel Interview
# --------------------------------------------------------------------------
@router.delete(
    "/interviews/{interview_id}",
    response_model=InterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel an interview",
    description="Allows the hiring recruiter to cancel an interview, transitioning status to cancelled and notifying the candidate.",
)
def cancel_interview(
    interview_id: int,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    interview = InterviewService.cancel_interview(
        db,
        interview_id=interview_id,
        recruiter_id=current_user.id,
    )
    return InterviewResponse.from_interview(interview)
