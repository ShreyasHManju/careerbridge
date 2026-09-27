from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.innovation_project import ProjectStatus, ProjectType
from app.models.user import User, UserRole
from app.schemas.innovation_project import (
    InnovationProjectCreate,
    InnovationProjectPaginationResponse,
    InnovationProjectResponse,
    InnovationProjectUpdate,
)
from app.schemas.project_milestone import (
    ProjectMilestoneCreate,
    ProjectMilestoneListResponse,
    ProjectMilestoneResponse,
    ProjectMilestoneUpdate,
)
from app.schemas.project_evidence import (
    ProjectEvidenceCreate,
    ProjectEvidenceListResponse,
    ProjectEvidenceResponse,
    ProjectEvidenceUpdate,
)
from app.schemas.project_evidence_verification import (
    EvidenceVerificationCreate,
    EvidenceVerificationResponse,
    EvidenceVerificationUpdate,
)
from app.services.innovation_project_service import InnovationProjectService
from app.services.project_milestone_service import ProjectMilestoneService
from app.services.project_evidence_service import ProjectEvidenceService
from app.services.project_evidence_verification_service import ProjectEvidenceVerificationService

router = APIRouter(prefix="/innovation-projects", tags=["Innovation Projects"])



@router.post(
    "",
    response_model=InnovationProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new innovation project",
    description="Allows an authenticated student to publish a real-world project. Ownership is securely derived from current_user.id.",
)
@router.post(
    "/",
    response_model=InnovationProjectResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_innovation_project(
    payload: InnovationProjectCreate,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Create a new innovation project for the authenticated student.
    Enforces student-only RBAC, automatic owner derivation, and canonical skill linking.
    """
    return InnovationProjectService.create_project(
        db=db,
        student_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/my",
    response_model=List[InnovationProjectResponse],
    summary="List authenticated student's owned projects",
    description="Retrieves all innovation projects (public, private, active, draft, archived) created by the authenticated student.",
)
def get_my_projects(
    status_filter: Optional[ProjectStatus] = Query(
        None,
        alias="status",
        description="Optional filter by lifecycle status (draft, active, archived)",
    ),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve all projects created by the authenticated student.
    """
    return InnovationProjectService.list_student_projects(
        db=db,
        student_id=current_user.id,
        status_filter=status_filter,
    )


@router.get(
    "",
    response_model=InnovationProjectPaginationResponse,
    summary="Search, filter, and paginate public innovation projects",
    description="Public project discovery endpoint. Returns active public projects matching search and filter criteria.",
)
@router.get("/", response_model=InnovationProjectPaginationResponse, include_in_schema=False)
def browse_public_projects(
    q: Optional[str] = Query(
        None,
        description="Search term operating across title, short description, description, and skills",
    ),
    project_type: Optional[ProjectType] = Query(
        None,
        description="Filter by project category (software, hardware, research, academic, entrepreneurship, social_impact, other)",
    ),
    skill: Optional[str] = Query(
        None,
        description="Filter by associated skill (case-insensitive partial match)",
    ),
    page: int = Query(1, ge=1, description="Page number (1-indexed, minimum: 1)"),
    page_size: int = Query(10, ge=1, le=100, description="Records per page (1 to 100)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Project discovery: Returns active, public innovation projects with pagination.
    """
    items, total, total_pages = InnovationProjectService.list_public_projects(
        db=db,
        q=q,
        project_type=project_type,
        skill=skill,
        page=page,
        page_size=page_size,
    )
    return InnovationProjectPaginationResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/{project_id}",
    response_model=InnovationProjectResponse,
    summary="Get single innovation project details",
    description="Retrieve details of a project by ID. Private projects return 404 if accessed by unauthorized candidates.",
)
def get_project_by_id(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the project"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve project details. Enforces visibility guard on private projects.
    """
    project = InnovationProjectService.get_project_by_id(
        db=db,
        project_id=project_id,
        current_user=current_user,
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Innovation project not found",
        )
    return project


@router.patch(
    "/{project_id}",
    response_model=InnovationProjectResponse,
    summary="Update an innovation project",
    description="Allows the project owner (student) to partially update project metadata, links, and associated skills.",
)
def update_innovation_project(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the project"),
    payload: InnovationProjectUpdate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Update existing innovation project fields. Enforces student ownership.
    """
    return InnovationProjectService.update_project(
        db=db,
        project_id=project_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an innovation project",
    description="Allows the owning student to permanently delete their innovation project.",
)
def delete_innovation_project(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the project"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Permanently delete an innovation project. Enforces student ownership.
    """
    InnovationProjectService.delete_project(
        db=db,
        project_id=project_id,
        student_id=current_user.id,
    )
    return None


# =========================================================================
# Project Milestones Sub-routes (Milestone 2.0-C)
# =========================================================================

@router.post(
    "/{project_id}/milestones",
    response_model=ProjectMilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new milestone for an innovation project",
    description="Allows the owning student to add a measurable execution milestone to their project.",
)
def create_project_milestone(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    payload: ProjectMilestoneCreate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Create a new milestone under the specified project. Enforces student ownership.
    """
    return ProjectMilestoneService.create_milestone(
        db=db,
        project_id=project_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/{project_id}/milestones",
    response_model=ProjectMilestoneListResponse,
    summary="List milestones for an innovation project",
    description="Retrieves all milestones and execution progress for a project. Respects private project visibility guards.",
)
def list_project_milestones(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List milestones for the specified project. Returns 404 for private projects if accessed by unauthorized users.
    """
    return ProjectMilestoneService.list_milestones(
        db=db,
        project_id=project_id,
        current_user=current_user,
    )


@router.patch(
    "/{project_id}/milestones/{milestone_id}",
    response_model=ProjectMilestoneResponse,
    summary="Update a project milestone",
    description="Allows the owning student to update a milestone's title, description, status, due date, or order.",
)
def update_project_milestone(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    milestone_id: int = Path(..., ge=1, description="Primary key identifier of the milestone"),
    payload: ProjectMilestoneUpdate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Update a milestone under the specified project. Enforces student ownership and status transition rules.
    """
    return ProjectMilestoneService.update_milestone(
        db=db,
        project_id=project_id,
        milestone_id=milestone_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/{project_id}/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project milestone",
    description="Allows the owning student to delete a milestone from their project.",
)
def delete_project_milestone(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    milestone_id: int = Path(..., ge=1, description="Primary key identifier of the milestone"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Delete a milestone from the specified project. Enforces student ownership.
    """
    ProjectMilestoneService.delete_milestone(
        db=db,
        project_id=project_id,
        milestone_id=milestone_id,
        student_id=current_user.id,
    )
    return None


# =========================================================================
# PROJECT EVIDENCE ENDPOINTS (Phase R5)
# =========================================================================

@router.post(
    "/{project_id}/evidence",
    response_model=ProjectEvidenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach an evidence artifact to an innovation project",
    description="Allows the owning student to attach evidence (repo, document, demo, video, link) to their project or a specific milestone.",
)
def create_project_evidence(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    payload: ProjectEvidenceCreate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Attach an evidence artifact to the specified project. Enforces student ownership and milestone integrity.
    """
    return ProjectEvidenceService.create_evidence(
        db=db,
        project_id=project_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/{project_id}/evidence",
    response_model=ProjectEvidenceListResponse,
    summary="List evidence artifacts for an innovation project",
    description="Retrieves all evidence items for a project. Respects private project visibility boundaries.",
)
def list_project_evidence(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    milestone_id: Optional[int] = Query(None, ge=1, description="Optional filter by milestone ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List evidence items for the specified project. Returns 404 for private projects if accessed by unauthorized users.
    """
    return ProjectEvidenceService.list_project_evidence(
        db=db,
        project_id=project_id,
        current_user=current_user,
        milestone_id=milestone_id,
    )


@router.get(
    "/{project_id}/evidence/{evidence_id}",
    response_model=ProjectEvidenceResponse,
    summary="Get single project evidence item",
    description="Retrieves single evidence item by ID. Respects private project visibility boundaries.",
)
def get_project_evidence(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    evidence_id: int = Path(..., ge=1, description="Primary key identifier of the evidence item"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a single evidence artifact. Enforces visibility access control.
    """
    return ProjectEvidenceService.get_evidence(
        db=db,
        project_id=project_id,
        evidence_id=evidence_id,
        current_user=current_user,
    )


@router.patch(
    "/{project_id}/evidence/{evidence_id}",
    response_model=ProjectEvidenceResponse,
    summary="Update a project evidence artifact",
    description="Allows the owning student to update an evidence item's title, description, URL, or milestone association.",
)
def update_project_evidence(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    evidence_id: int = Path(..., ge=1, description="Primary key identifier of the evidence item"),
    payload: ProjectEvidenceUpdate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Update an evidence artifact. Enforces student ownership.
    """
    return ProjectEvidenceService.update_evidence(
        db=db,
        project_id=project_id,
        evidence_id=evidence_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/{project_id}/evidence/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project evidence artifact",
    description="Allows the owning student to delete an evidence artifact from their project.",
)
def delete_project_evidence(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    evidence_id: int = Path(..., ge=1, description="Primary key identifier of the evidence item"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Delete an evidence artifact. Enforces student ownership.
    """
    ProjectEvidenceService.delete_evidence(
        db=db,
        project_id=project_id,
        evidence_id=evidence_id,
        student_id=current_user.id,
    )
    return None


# =========================================================================
# PROJECT EVIDENCE VERIFICATION ENDPOINTS (Milestone R6)
# =========================================================================

@router.post(
    "/{project_id}/evidence/{evidence_id}/verification",
    response_model=EvidenceVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or update project evidence verification decision",
    description="Allows platform administrators to verify or reject project evidence artifacts. Students cannot self-verify.",
)
def create_or_update_evidence_verification(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    evidence_id: int = Path(..., ge=1, description="Primary key identifier of the evidence item"),
    payload: EvidenceVerificationCreate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluate and record verification decision for a project evidence artifact.
    Enforces admin authority and prevents student self-approval.
    """
    return ProjectEvidenceVerificationService.create_or_update_verification(
        db=db,
        project_id=project_id,
        evidence_id=evidence_id,
        current_user=current_user,
        payload=payload,
    )


@router.get(
    "/{project_id}/evidence/{evidence_id}/verification",
    response_model=EvidenceVerificationResponse,
    summary="Get project evidence verification status",
    description="Retrieves current verification state for an evidence artifact. Respects private project visibility guards.",
)
def get_evidence_verification(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    evidence_id: int = Path(..., ge=1, description="Primary key identifier of the evidence item"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get verification state for an evidence artifact.
    """
    return ProjectEvidenceVerificationService.get_verification(
        db=db,
        project_id=project_id,
        evidence_id=evidence_id,
        current_user=current_user,
    )


@router.patch(
    "/{project_id}/evidence/{evidence_id}/verification",
    response_model=EvidenceVerificationResponse,
    summary="Partially update evidence verification state",
    description="Allows platform administrators to update verification status or review notes.",
)
def update_evidence_verification(
    project_id: int = Path(..., ge=1, description="Primary key identifier of the parent project"),
    evidence_id: int = Path(..., ge=1, description="Primary key identifier of the evidence item"),
    payload: EvidenceVerificationUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update verification state for an evidence artifact. Enforces admin authority.
    """
    return ProjectEvidenceVerificationService.create_or_update_verification(
        db=db,
        project_id=project_id,
        evidence_id=evidence_id,
        current_user=current_user,
        payload=payload,
    )
