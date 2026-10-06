from typing import List
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.candidate_evaluation import (
    CandidateEvaluationCreate,
    CandidateEvaluationResponse,
    CandidateEvaluationUpdate,
)
from app.services.candidate_evaluation_service import CandidateEvaluationService

router = APIRouter(tags=["Candidate Evaluations"])


# =========================================================================
# Application-scoped Candidate Evaluation Endpoints
# =========================================================================

@router.post(
    "/applications/{application_id}/evaluations",
    response_model=CandidateEvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or submit candidate evaluation",
    description="Allows an authorized recruiter to create a draft or submitted evaluation scorecard for a candidate application.",
)
def create_candidate_evaluation(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the candidate application"),
    payload: CandidateEvaluationCreate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Create a new candidate evaluation (DRAFT or SUBMITTED).
    Enforces recruiter role, job ownership, and 1-5 score boundaries.
    """
    return CandidateEvaluationService.create_evaluation(
        db=db,
        application_id=application_id,
        recruiter_user=current_user,
        payload=payload,
    )


@router.get(
    "/applications/{application_id}/evaluations",
    response_model=List[CandidateEvaluationResponse],
    summary="List candidate evaluations for an application",
    description="Retrieves all candidate evaluations for the application. Restricted strictly to authorized recruiters.",
)
def list_application_candidate_evaluations(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the candidate application"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List evaluations for a candidate application.
    Students receive 403 (candidate evaluations are private recruiter records).
    Cross-recruiter access receives 403.
    """
    return CandidateEvaluationService.list_application_evaluations(
        db=db,
        application_id=application_id,
        current_user=current_user,
    )


# =========================================================================
# Standalone Evaluation Lifecycle Endpoints (/evaluations/{evaluation_id})
# =========================================================================

@router.get(
    "/evaluations/{evaluation_id}",
    response_model=CandidateEvaluationResponse,
    summary="Get candidate evaluation by ID",
    description="Retrieves candidate evaluation scorecard details for authorized recruiter.",
)
def get_candidate_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get single candidate evaluation with strict authorization checks.
    Students receive 403.
    """
    return CandidateEvaluationService.get_evaluation_by_id(
        db=db,
        evaluation_id=evaluation_id,
        current_user=current_user,
    )


@router.patch(
    "/evaluations/{evaluation_id}",
    response_model=CandidateEvaluationResponse,
    summary="Update draft candidate evaluation",
    description="Allows the owning recruiter to update draft evaluation scores, recommendation, and notes.",
)
def update_candidate_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    payload: CandidateEvaluationUpdate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Update a draft candidate evaluation. Finalized (SUBMITTED) evaluations cannot be modified.
    """
    return CandidateEvaluationService.update_evaluation(
        db=db,
        evaluation_id=evaluation_id,
        recruiter_user=current_user,
        payload=payload,
    )


@router.post(
    "/evaluations/{evaluation_id}/submit",
    response_model=CandidateEvaluationResponse,
    summary="Submit and finalize candidate evaluation",
    description="Finalizes and submits a DRAFT evaluation scorecard. Requires all 4 dimension scores and a recommendation.",
)
def submit_candidate_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Submit and finalize a draft candidate evaluation.
    """
    return CandidateEvaluationService.submit_evaluation(
        db=db,
        evaluation_id=evaluation_id,
        recruiter_user=current_user,
    )


@router.get(
    "/recruiter/evaluations",
    response_model=List[CandidateEvaluationResponse],
    summary="List all candidate evaluations created by current recruiter",
    description="Retrieves all candidate evaluations created by the authenticated recruiter across all their job postings.",
)
def list_my_recruiter_evaluations(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    List recruiter's candidate evaluations.
    """
    return CandidateEvaluationService.list_recruiter_evaluations(
        db=db,
        recruiter_user=current_user,
    )
