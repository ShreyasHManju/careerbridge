from datetime import datetime
import enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.job_posting import EmploymentType, OpportunityType
from app.schemas.skill import SkillResponse


class JobSortBy(str, enum.Enum):
    """Supported sort fields for job discovery."""
    CREATED_AT = "created_at"
    APPLICATION_DEADLINE = "application_deadline"
    SALARY_MIN = "salary_min"


class SortOrder(str, enum.Enum):
    """Supported sort orders."""
    ASC = "asc"
    DESC = "desc"


class JobPostingCreate(BaseModel):
    """
    Schema for creating a new Job/Internship Posting.
    recruiter_id is NEVER accepted from the client; it is securely derived from current_user.id.
    """
    title: str = Field(..., min_length=2, max_length=150, description="Job or internship title")
    description: str = Field(..., min_length=10, description="Detailed opportunity description")
    opportunity_type: OpportunityType = Field(..., description="Opportunity category: internship or job")
    company_name: str = Field(..., min_length=2, max_length=150, description="Hiring company name")
    location: Optional[str] = Field(None, max_length=150, description="Job location")
    is_remote: bool = Field(False, description="Whether position is fully remote")
    employment_type: EmploymentType = Field(..., description="Employment type: full_time, part_time, contract")
    skills: Optional[str] = Field(None, max_length=1000, description="Required skills")
    minimum_qualification: Optional[str] = Field(None, max_length=100, description="Minimum educational qualification")
    experience_required: Optional[str] = Field(None, max_length=50, description="Experience requirements")
    salary_min: Optional[int] = Field(None, ge=0, description="Minimum compensation or stipend")
    salary_max: Optional[int] = Field(None, ge=0, description="Maximum compensation or stipend")
    application_deadline: Optional[datetime] = Field(None, description="Application submission deadline")
    is_active: bool = Field(True, description="Whether posting is active and visible to candidates")

    @model_validator(mode="after")
    def validate_salary_range(self) -> "JobPostingCreate":
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_max < self.salary_min:
                raise ValueError("salary_max cannot be less than salary_min")
        return self


class JobPostingUpdate(BaseModel):
    """
    Schema for partially updating an existing JobPosting.
    All fields are optional; ownership (recruiter_id) cannot be modified.
    """
    title: Optional[str] = Field(None, min_length=2, max_length=150, description="Job or internship title")
    description: Optional[str] = Field(None, min_length=10, description="Detailed opportunity description")
    opportunity_type: Optional[OpportunityType] = Field(None, description="Opportunity category")
    company_name: Optional[str] = Field(None, min_length=2, max_length=150, description="Hiring company name")
    location: Optional[str] = Field(None, max_length=150, description="Job location")
    is_remote: Optional[bool] = Field(None, description="Whether position is fully remote")
    employment_type: Optional[EmploymentType] = Field(None, description="Employment type")
    skills: Optional[str] = Field(None, max_length=1000, description="Required skills")
    minimum_qualification: Optional[str] = Field(None, max_length=100, description="Minimum qualification")
    experience_required: Optional[str] = Field(None, max_length=50, description="Experience requirements")
    salary_min: Optional[int] = Field(None, ge=0, description="Minimum compensation")
    salary_max: Optional[int] = Field(None, ge=0, description="Maximum compensation")
    application_deadline: Optional[datetime] = Field(None, description="Application deadline")
    is_active: Optional[bool] = Field(None, description="Active status")

    @model_validator(mode="after")
    def validate_salary_range(self) -> "JobPostingUpdate":
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_max < self.salary_min:
                raise ValueError("salary_max cannot be less than salary_min")
        return self


class MatchedSkillItem(BaseModel):
    """
    Represents a skill required by a job that is matched by the candidate student,
    along with verification status and provenance source.
    """
    id: int
    name: str
    slug: str
    category: Optional[str] = None
    is_verified: bool = False
    source: str = Field(
        ...,
        description="Origin of skill verification: 'experience', 'evaluation', 'project', or 'profile'",
    )

    model_config = ConfigDict(from_attributes=True)


class JobMatchSummary(BaseModel):
    """
    Diagnostic match breakdown between a student's verified/claimed skills
    and a job posting's required skills.
    """
    match_percentage: int = Field(..., ge=0, le=100, description="Match score from 0 to 100")
    total_required: int = Field(..., ge=0, description="Total skills required by the opportunity")
    total_matched: int = Field(..., ge=0, description="Total required skills possessed by the student")
    total_verified_matched: int = Field(..., ge=0, description="Total matched skills backed by verified evidence")
    total_missing: int = Field(..., ge=0, description="Total required skills missing from student profile")
    matched_skills: List[MatchedSkillItem] = Field(default_factory=list)
    missing_skills: List[SkillResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class JobPostingResponse(BaseModel):
    """
    Safe public response schema for JobPosting.
    Excludes sensitive internal user credentials.
    """
    id: int
    recruiter_id: int
    title: str
    description: str
    opportunity_type: OpportunityType
    company_name: str
    location: Optional[str] = None
    is_remote: bool
    employment_type: EmploymentType
    skills: Optional[str] = None
    structured_skills: Optional[List[SkillResponse]] = None
    minimum_qualification: Optional[str] = None
    experience_required: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    application_deadline: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Phase 6 Additive Field: Populated only for authenticated students; None for recruiters/admins
    match_summary: Optional[JobMatchSummary] = None

    model_config = ConfigDict(from_attributes=True)


class JobPostingPaginationResponse(BaseModel):
    """
    Paginated envelope response schema for JobPosting discovery.
    """
    items: List[JobPostingResponse]
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total: int = Field(..., description="Total count of active postings matching criteria")
    total_pages: int = Field(..., description="Total pages available")

    model_config = ConfigDict(from_attributes=True)
