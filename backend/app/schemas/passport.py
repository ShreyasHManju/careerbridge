from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.skill import SkillResponse


class PassportIdentity(BaseModel):
    """Identity and academic metadata for an Experience Passport."""
    user_id: int
    email: str
    full_name: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    bio: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    is_verified: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PassportSummary(BaseModel):
    """Aggregate metric counts derived from verified evidence."""
    verified_experiences_count: int = Field(0, description="Total count of recruiter/admin-verified experiences")
    public_projects_count: int = Field(0, description="Total count of public active innovation projects")
    canonical_skills_count: int = Field(0, description="Count of distinct canonical skills backed by evidence")
    completed_milestones_count: int = Field(0, description="Total completed milestones across public projects")


class PassportSkillItem(BaseModel):
    """Canonical skill with evidence provenance tags."""
    id: int
    name: str
    slug: str
    category: Optional[str] = None
    is_verified: bool = True
    sources: List[str] = Field(default_factory=list, description="Evidence provenance (experience, project, profile)")

    model_config = ConfigDict(from_attributes=True)


class PassportExperienceItem(BaseModel):
    """Verified experience record safe for public and recruiter presentation."""
    id: int
    title: str
    organization_name: Optional[str] = None
    experience_type: str
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    description: str
    status: str
    verification_source: str
    verified_at: Optional[datetime] = None
    innovation_project_id: Optional[int] = None
    innovation_project_title: Optional[str] = None
    skills: Optional[str] = None
    structured_skills: List[SkillResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PassportMilestoneItem(BaseModel):
    """Project milestone execution entry."""
    id: int
    innovation_project_id: int
    project_title: str
    title: str
    description: Optional[str] = None
    status: str
    display_order: int = 0
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PassportProjectItem(BaseModel):
    """Public innovation project with milestones and skills."""
    id: int
    title: str
    slug: str
    short_description: Optional[str] = None
    description: str
    project_type: str
    status: str
    visibility: str
    repository_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    skills: Optional[str] = None
    structured_skills: List[SkillResponse] = Field(default_factory=list)
    total_milestones: int = 0
    completed_milestones: int = 0
    progress_percentage: int = 0
    milestones: List[PassportMilestoneItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PassportResumeInfo(BaseModel):
    """Safe metadata for an attached resume document."""
    id: int
    original_filename: str
    content_type: str
    file_size: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PassportResponse(BaseModel):
    """Comprehensive Experience Passport aggregated payload."""
    identity: PassportIdentity
    summary: PassportSummary
    verified_experiences: List[PassportExperienceItem] = Field(default_factory=list)
    projects: List[PassportProjectItem] = Field(default_factory=list)
    skills: List[PassportSkillItem] = Field(default_factory=list)
    milestones: List[PassportMilestoneItem] = Field(default_factory=list)
    resume: Optional[PassportResumeInfo] = None
    is_owner: bool = False

    model_config = ConfigDict(from_attributes=True)
