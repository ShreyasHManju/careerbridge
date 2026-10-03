from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.job_invitation import InvitationStatus


class JobInvitationCreate(BaseModel):
    student_id: int = Field(..., ge=1, description="Target student user ID")
    message: Optional[str] = Field(None, max_length=2000, description="Optional personalized invitation message")


class JobInvitationUpdate(BaseModel):
    status: InvitationStatus = Field(..., description="Response status: 'accepted' or 'declined'")


class JobInvitationJobSummary(BaseModel):
    id: int
    title: str
    company_name: str
    location: Optional[str] = None
    is_remote: bool = False
    opportunity_type: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class JobInvitationRecruiterSummary(BaseModel):
    id: int
    full_name: Optional[str] = None
    company_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JobInvitationStudentSummary(BaseModel):
    id: int
    full_name: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JobInvitationResponse(BaseModel):
    id: int
    job_id: int
    recruiter_id: int
    student_id: int
    message: Optional[str] = None
    status: InvitationStatus
    created_at: datetime
    updated_at: datetime
    responded_at: Optional[datetime] = None
    job_posting: Optional[JobInvitationJobSummary] = None
    recruiter: Optional[JobInvitationRecruiterSummary] = None
    student: Optional[JobInvitationStudentSummary] = None

    model_config = ConfigDict(from_attributes=True)
