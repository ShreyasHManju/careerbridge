from datetime import datetime
import re
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.innovation_project import ProjectStatus, ProjectType, ProjectVisibility
from app.schemas.skill import SkillResponse
from app.schemas.project_milestone import ProjectMilestoneResponse

URL_REGEX = re.compile(
    r"^https?://"
    r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
    r"localhost|"
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
    r"(?::\d+)?"
    r"(?:/?|[/?]\S+)$",
    re.IGNORECASE,
)


def validate_optional_url(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    trimmed = v.strip()
    if not trimmed:
        return None
    if not URL_REGEX.match(trimmed):
        raise ValueError("Invalid URL format. Must start with http:// or https:// and include a valid domain")
    return trimmed


class InnovationProjectBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Title of the innovation project")
    short_description: Optional[str] = Field(None, max_length=300, description="Brief summary of the project")
    description: str = Field(..., min_length=10, max_length=5000, description="Detailed project description and architecture")
    project_type: ProjectType = Field(default=ProjectType.SOFTWARE, description="Controlled project category")
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE, description="Lifecycle status (draft, active, archived)")
    visibility: ProjectVisibility = Field(default=ProjectVisibility.PUBLIC, description="Visibility (public or private)")
    skills: Optional[str] = Field(None, max_length=1000, description="Comma-separated skill names")
    repository_url: Optional[str] = Field(None, max_length=255, description="Repository URL (e.g. GitHub, GitLab)")
    live_demo_url: Optional[str] = Field(None, max_length=255, description="Live deployment or project demo URL")

    @field_validator("repository_url", "live_demo_url", mode="before")
    @classmethod
    def validate_urls(cls, v: Optional[str]) -> Optional[str]:
        return validate_optional_url(v)


class InnovationProjectCreate(InnovationProjectBase):
    """Schema for creating a new InnovationProject by an authenticated student."""
    pass


class InnovationProjectUpdate(BaseModel):
    """Schema for partially updating an existing InnovationProject. All fields optional."""
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    short_description: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    project_type: Optional[ProjectType] = None
    status: Optional[ProjectStatus] = None
    visibility: Optional[ProjectVisibility] = None
    skills: Optional[str] = Field(None, max_length=1000)
    repository_url: Optional[str] = Field(None, max_length=255)
    live_demo_url: Optional[str] = Field(None, max_length=255)

    @field_validator("repository_url", "live_demo_url", mode="before")
    @classmethod
    def validate_urls(cls, v: Optional[str]) -> Optional[str]:
        return validate_optional_url(v)


class InnovationProjectResponse(BaseModel):
    """Safe response schema for an InnovationProject."""
    id: int
    student_id: int
    title: str
    slug: str
    short_description: Optional[str] = None
    description: str
    project_type: ProjectType
    status: ProjectStatus
    visibility: ProjectVisibility
    skills: Optional[str] = None
    structured_skills: Optional[List[SkillResponse]] = None
    repository_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    milestones: Optional[List[ProjectMilestoneResponse]] = None
    total_milestones: Optional[int] = None
    completed_milestones: Optional[int] = None
    progress_percentage: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class InnovationProjectPaginationResponse(BaseModel):
    """Paginated list response for innovation projects."""
    items: List[InnovationProjectResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
