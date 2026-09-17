from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.job_posting import EmploymentType, OpportunityType


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
    minimum_qualification: Optional[str] = None
    experience_required: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    application_deadline: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
