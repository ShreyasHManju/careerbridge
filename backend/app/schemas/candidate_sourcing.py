from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.skill import SkillResponse


class CandidateSourcingEducation(BaseModel):
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CandidatePassportSummarySchema(BaseModel):
    verified_experiences_count: int = 0
    public_projects_count: int = 0
    canonical_skills_count: int = 0
    completed_milestones_count: int = 0
    verified_evidence_count: int = 0
    total_evaluations_count: Optional[int] = 0
    average_project_score: Optional[float] = None
    is_verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class CandidateProjectPreviewSchema(BaseModel):
    id: int
    title: str
    slug: Optional[str] = None
    short_description: Optional[str] = None
    project_type: str = "capstone"
    visibility: str = "public"
    progress_percentage: int = 100
    verified_evidence_count: int = 0
    average_evaluation_score: Optional[float] = None
    evaluations_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class CandidateSourcingItem(BaseModel):
    id: int
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    education: CandidateSourcingEducation
    skills: List[SkillResponse] = []
    verified_skills: List[SkillResponse] = []
    top_projects: List[CandidateProjectPreviewSchema] = []
    passport_summary: CandidatePassportSummarySchema
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CandidateSearchResponseSchema(BaseModel):
    items: List[CandidateSourcingItem]
    total: int
    page: int
    page_size: int
    total_pages: int
