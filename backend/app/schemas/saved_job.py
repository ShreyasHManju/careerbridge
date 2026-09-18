from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.job_posting import EmploymentType, OpportunityType


class SavedJobStatusResponse(BaseModel):
    """
    Response schema indicating whether a specific job posting is saved by the current student.
    """
    job_id: int = Field(..., description="ID of the job posting")
    is_saved: bool = Field(..., description="Whether the job is saved by the authenticated student")
    saved_at: Optional[datetime] = Field(None, description="Timestamp when the job was saved, if saved")

    model_config = ConfigDict(from_attributes=True)


class SavedJobResponse(BaseModel):
    """
    Response schema for a saved job posting, including both job details and bookmark metadata.
    """
    id: int = Field(..., description="ID of the job posting")
    saved_id: int = Field(..., description="ID of the saved_jobs bookmark entry")
    title: str = Field(..., description="Job or internship title")
    description: str = Field(..., description="Detailed opportunity description")
    opportunity_type: OpportunityType = Field(..., description="Opportunity category: internship or job")
    company_name: str = Field(..., description="Hiring company name")
    location: Optional[str] = Field(None, description="Job location")
    is_remote: bool = Field(..., description="Whether position is fully remote")
    employment_type: EmploymentType = Field(..., description="Employment type: full_time, part_time, contract")
    skills: Optional[str] = Field(None, description="Required skills")
    minimum_qualification: Optional[str] = Field(None, description="Minimum educational qualification")
    experience_required: Optional[str] = Field(None, description="Experience requirements")
    salary_min: Optional[int] = Field(None, description="Minimum compensation or stipend")
    salary_max: Optional[int] = Field(None, description="Maximum compensation or stipend")
    application_deadline: Optional[datetime] = Field(None, description="Application submission deadline")
    is_active: bool = Field(..., description="Whether posting is currently active")
    created_at: datetime = Field(..., description="Timestamp when the job posting was created")
    updated_at: datetime = Field(..., description="Timestamp when the job posting was last updated")
    saved_at: datetime = Field(..., description="Timestamp when the job was saved by the student")

    model_config = ConfigDict(from_attributes=True)
