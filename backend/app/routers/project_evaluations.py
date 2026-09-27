from typing import List
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.project_evaluation import (
    ProjectEvaluationCreate,
    ProjectEvaluationListResponse,
    ProjectEvaluationResponse,
    ProjectEvaluationUpdate,
)
from app.services.project_evaluation_service import ProjectEvaluationService

router = APIRouter(tags=["Project Evaluations"])


# =========================================================================
# Project-scoped Evaluation Endpoints (/innovation-projects/{project_id}/evaluations)
# =========================================================================

@router.post(
    "/innovation-projects/{project_id}/evaluations",
    response_model=ProjectEvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a draft project evaluation",
    description="Allows an authorized recruiter to create a draft evaluation for a student's Innovation Project.",
)
def create_project_evaluation(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the project"),
    payload: ProjectEvaluationCreate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Create a new evaluation in DRAFT status. Enforces recruiter role, candidate authorization,
    and unique evaluation constraint per (project_id, recruiter_id).
    """
    return ProjectEvaluationService.create_evaluation(
        db=db,
        project_id=project_id,
        recruiter_user=current_user,
        payload=payload,
    )


@router.get(
    "/innovation-projects/{project_id}/evaluations",
    response_model=List[ProjectEvaluationResponse],
    summary="List evaluations for an innovation project",
    description="Retrieves evaluations for a project. Students only see SUBMITTED evaluations. Recruiters see their own.",
)
def list_project_evaluations(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the project"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List evaluations for the specified project with role-based visibility filtering.
    """
    return ProjectEvaluationService.list_project_evaluations(
        db=db,
        project_id=project_id,
        current_user=current_user,
    )


# =========================================================================
# Standalone Evaluation Lifecycle Endpoints (/project-evaluations/{evaluation_id})
# =========================================================================

@router.get(
    "/project-evaluations/{evaluation_id}",
    response_model=ProjectEvaluationResponse,
    summary="Get evaluation by ID",
    description="Retrieve evaluation details. DRAFTs are visible only to the owning recruiter. SUBMITTED evaluations are visible to recruiter, student owner, or admin.",
)
def get_project_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get single project evaluation with strict ownership and status visibility checks.
    """
    return ProjectEvaluationService.get_evaluation_by_id(
        db=db,
        evaluation_id=evaluation_id,
        current_user=current_user,
    )


@router.patch(
    "/project-evaluations/{evaluation_id}",
    response_model=ProjectEvaluationResponse,
    summary="Update draft evaluation",
    description="Allows the owning recruiter to update their DRAFT evaluation scores, recommendation, and feedback.",
)
def update_project_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    payload: ProjectEvaluationUpdate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Update a draft evaluation. Immutable once submitted.
    """
    return ProjectEvaluationService.update_evaluation(
        db=db,
        evaluation_id=evaluation_id,
        recruiter_user=current_user,
        payload=payload,
    )


@router.post(
    "/project-evaluations/{evaluation_id}/submit",
    response_model=ProjectEvaluationResponse,
    summary="Submit evaluation",
    description="Submits a DRAFT evaluation. Validates all 5 dimensional scores and recommendation, calculates overall score, and notifies the student.",
)
def submit_project_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Submit evaluation for final student visibility. Atomic transition from DRAFT -> SUBMITTED.
    """
    return ProjectEvaluationService.submit_evaluation(
        db=db,
        evaluation_id=evaluation_id,
        recruiter_user=current_user,
    )


@router.post(
    "/project-evaluations/{evaluation_id}/withdraw",
    response_model=ProjectEvaluationResponse,
    summary="Withdraw evaluation",
    description="Withdraws an evaluation. Allowed only for the owning recruiter or an admin.",
)
def withdraw_project_evaluation(
    evaluation_id: int = Path(..., ge=1, description="Primary key identifier of the evaluation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Withdraw evaluation. Enforces ownership or admin role.
    """
    return ProjectEvaluationService.withdraw_evaluation(
        db=db,
        evaluation_id=evaluation_id,
        current_user=current_user,
    )
