from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.skill import SkillResponse
from app.services.skill_service import search_canonical_skills

router = APIRouter(
    prefix="/skills",
    tags=["Skills"],
)


@router.get(
    "",
    response_model=List[SkillResponse],
    status_code=status.HTTP_200_OK,
    summary="Search canonical skills catalog",
    description="Search and retrieve skills from the master catalog for autocomplete, tag selection, and discovery.",
)
def list_skills(
    q: Optional[str] = Query(
        None,
        description="Search term operating across skill name and slug (case-insensitive partial match)",
    ),
    category: Optional[str] = Query(
        None,
        description="Filter skills by category (e.g. Frontend, Backend, DevOps, Data)",
    ),
    limit: int = Query(
        20,
        ge=1,
        le=100,
        description="Maximum number of canonical skills to return (1-100)",
    ),
    db: Session = Depends(get_db),
) -> List[SkillResponse]:
    """
    Retrieve matching canonical skills from the database.
    """
    skills = search_canonical_skills(db, q=q, category=category, limit=limit)
    return skills
