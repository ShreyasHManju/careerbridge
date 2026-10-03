from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.schemas.candidate_sourcing import CandidateSearchResponseSchema
from app.services.candidate_sourcing_service import CandidateSourcingService

router = APIRouter(tags=["Recruiter Candidate Sourcing"])


@router.get(
    "/recruiter/candidates",
    response_model=CandidateSearchResponseSchema,
    summary="Search discoverable student candidate talent directory",
    description="Proactively search and filter eligible student candidates via verified skills, passport credentials, and innovation projects.",
)
def search_candidates(
    q: Optional[str] = Query(None, description="Search query across candidate name, bio, skills, or college"),
    skills: Optional[str] = Query(None, description="Comma-separated skill names or slugs"),
    degree: Optional[str] = Query(None, description="Degree filter"),
    graduation_year: Optional[int] = Query(None, ge=2000, le=2100, description="Graduation year filter"),
    has_verified_passport: bool = Query(False, description="Filter for candidates with verified experience claims/evidence"),
    min_verified_skills: Optional[int] = Query(None, ge=1, description="Minimum count of verified skills"),
    sort_by: str = Query("verified_skills", description="Sort by: 'verified_skills', 'top_rated_projects', or 'recent'"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Page size"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    skill_list = [s.strip() for s in skills.split(",") if s.strip()] if skills else None

    return CandidateSourcingService.search_candidates(
        db=db,
        query=q,
        skills=skill_list,
        degree=degree,
        graduation_year=graduation_year,
        has_verified_passport=has_verified_passport,
        min_verified_skills=min_verified_skills,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )
