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
from app.services.innovation_project_service import InnovationProjectService

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
