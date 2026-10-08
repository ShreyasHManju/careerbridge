from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.job_posting import JobPosting
from app.models.project_blueprint import (
    BlueprintDifficulty,
    BlueprintStatus,
    ProjectBlueprint,
    ProjectBlueprintSkill,
)
from app.models.innovation_project import ProjectType
from app.models.user import User, UserRole
from app.schemas.innovation_project import InnovationProjectResponse
from app.schemas.project_blueprint import (
    JobProjectRecommendationsResponse,
    ProjectBlueprintDetailResponse,
    ProjectBlueprintPaginationResponse,
    ProjectBlueprintSummaryResponse,
    SkillProjectRecommendationsResponse,
)
from app.services.innovation_project_service import InnovationProjectService
from app.services.opportunity_match_service import OpportunityMatchService
from app.services.project_recommendation_service import (
    ProjectRecommendationService,
    serialize_blueprint_detail,
    serialize_blueprint_summary,
)

router = APIRouter(prefix="/projects", tags=["Project Blueprints"])


# ============================================================================
# 1. BLUEPRINT BROWSING & DETAIL
# ============================================================================

@router.get(
    "/blueprints",
    response_model=ProjectBlueprintPaginationResponse,
    summary="List curated project blueprints",
    description="Lists published project blueprints for students and recruiters, or all statuses for administrators. Supports filtering and search.",
)
def list_blueprints(
    search: Optional[str] = Query(None, description="Search term matching title or summary"),
    difficulty: Optional[BlueprintDifficulty] = Query(None, description="Filter by difficulty level"),
    project_type: Optional[ProjectType] = Query(None, description="Filter by project type"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.RECRUITER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    conditions = []

    # Non-admins only see PUBLISHED blueprints
    if current_user.role != UserRole.ADMIN:
        conditions.append(ProjectBlueprint.status == BlueprintStatus.PUBLISHED)

    if difficulty is not None:
        conditions.append(ProjectBlueprint.difficulty_level == difficulty)

    if project_type is not None:
        conditions.append(ProjectBlueprint.project_type == project_type)

    if search and search.strip():
        q = f"%{search.strip()}%"
        conditions.append(
            or_(
                ProjectBlueprint.title.ilike(q),
                ProjectBlueprint.summary.ilike(q),
                ProjectBlueprint.learning_objectives.ilike(q),
            )
        )

    # Count total
    count_stmt = select(func.count(ProjectBlueprint.id)).where(*conditions)
    total = db.scalar(count_stmt) or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    # Query items
    stmt = (
        select(ProjectBlueprint)
        .where(*conditions)
        .options(
            selectinload(ProjectBlueprint.blueprint_skills).selectinload(ProjectBlueprintSkill.skill),
            selectinload(ProjectBlueprint.milestones),
        )
        .order_by(ProjectBlueprint.created_at.desc(), ProjectBlueprint.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    blueprints = list(db.scalars(stmt).unique().all())

    items = [serialize_blueprint_summary(bp) for bp in blueprints]

    return ProjectBlueprintPaginationResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/blueprints/{blueprint_id}",
    response_model=ProjectBlueprintDetailResponse,
    summary="Get project blueprint detail",
    description="Retrieves a single project blueprint with milestone deliverables and evidence guidance.",
)
def get_blueprint_detail(
    blueprint_id: int = Path(..., ge=1, description="Primary key of the blueprint"),
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.RECRUITER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    blueprint = db.scalar(
        select(ProjectBlueprint)
        .options(
            selectinload(ProjectBlueprint.blueprint_skills).selectinload(ProjectBlueprintSkill.skill),
            selectinload(ProjectBlueprint.milestones),
        )
        .where(ProjectBlueprint.id == blueprint_id)
    )

    if not blueprint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project blueprint not found",
        )

    # Non-admins can only view published blueprints
    if current_user.role != UserRole.ADMIN and blueprint.status != BlueprintStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project blueprint not found",
        )

    return serialize_blueprint_detail(blueprint)


# ============================================================================
# 2. BLUEPRINT INSTANTIATION (Student only)
# ============================================================================

@router.post(
    "/blueprints/{blueprint_id}/instantiate",
    response_model=InnovationProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Instantiate project blueprint into student project",
    description="Clones a published project blueprint into a new private student InnovationProject with pre-configured milestones and skills.",
)
def instantiate_blueprint(
    blueprint_id: int = Path(..., ge=1, description="Primary key of the blueprint to instantiate"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    project = InnovationProjectService.instantiate_blueprint(
        db=db,
        blueprint_id=blueprint_id,
        student_id=current_user.id,
    )
    return project


# ============================================================================
# 3. RECOMMENDATIONS (Student only)
# ============================================================================

@router.get(
    "/recommendations/jobs/{job_id}",
    response_model=JobProjectRecommendationsResponse,
    summary="Get recommended blueprints for job skill gaps",
    description="Identifies missing skills for the authenticated student against a target job posting and returns ranked project blueprints.",
)
def get_job_project_recommendations(
    job_id: int = Path(..., ge=1, description="Primary key of the job posting"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    job = db.scalar(
        select(JobPosting)
        .options(
            selectinload(JobPosting.job_skills),
        )
        .where(JobPosting.id == job_id)
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    # 1. Compile student's owned skills
    student_skills_map = OpportunityMatchService.compile_student_skills(db, current_user.id)

    # 2. Compute deterministic match and missing skills
    match_summary = OpportunityMatchService.compute_job_match(
        job_skills=job.structured_skills,
        student_skills_map=student_skills_map,
    )

    missing_skills = match_summary.missing_skills
    missing_skill_ids = {s.id for s in missing_skills if s.id is not None}

    # 3. Rank blueprints
    recommendations = ProjectRecommendationService.rank_blueprints_for_missing_skills(
        db=db,
        missing_skill_ids=missing_skill_ids,
        student_id=current_user.id,
        limit=6,
    )

    return JobProjectRecommendationsResponse(
        job_id=job.id,
        job_title=job.title,
        total_missing_skills=len(missing_skills),
        missing_skills=missing_skills,
        recommendations=recommendations,
    )


@router.get(
    "/recommendations/skills",
    response_model=SkillProjectRecommendationsResponse,
    summary="Get recommended blueprints for target skills",
    description="Returns ranked project blueprints that cover the provided target/missing skill IDs.",
)
def get_skills_project_recommendations(
    skill_ids: List[int] = Query(..., description="Target skill IDs to match blueprints against"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    valid_skill_ids = {s for s in skill_ids if s > 0}
    if not valid_skill_ids:
        return SkillProjectRecommendationsResponse(
            target_skill_ids=[],
            total_blueprints_found=0,
            recommendations=[],
        )

    recommendations = ProjectRecommendationService.rank_blueprints_for_missing_skills(
        db=db,
        missing_skill_ids=valid_skill_ids,
        student_id=current_user.id,
        limit=10,
    )

    return SkillProjectRecommendationsResponse(
        target_skill_ids=list(valid_skill_ids),
        total_blueprints_found=len(recommendations),
        recommendations=recommendations,
    )
