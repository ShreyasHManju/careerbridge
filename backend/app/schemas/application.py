from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.application import ApplicationStatus


class ApplicationCreate(BaseModel):
    """
    Schema for a student submitting an application to a job posting.
    student_id is NEVER accepted from the client; it is securely derived from current_user.id.
    status is automatically set to 'applied' by the server.
    """
    cover_message: Optional[str] = Field(
        None, max_length=2000, description="Optional cover note or candidate message"
    )


class ApplicationUpdate(BaseModel):
    """
    Schema for a recruiter updating an application's lifecycle status.
    student_id and job_posting_id are immutable and cannot be altered.
    """
    status: ApplicationStatus = Field(
        ..., description="Updated application status (applied, reviewing, shortlisted, rejected, accepted)"
    )


class ApplicationBulkStatusUpdate(BaseModel):
    """
    Schema for a recruiter updating multiple applications in a single atomic batch action.
    """
    application_ids: List[int] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of target application IDs to transition (1 to 100 items)",
    )
    status: ApplicationStatus = Field(
        ..., description="Target application status (applied, reviewing, shortlisted, rejected, accepted)"
    )


class ApplicationResponse(BaseModel):
    """
    Safe public response schema for Application.
    Excludes sensitive user credentials.
    """
    id: int
    job_posting_id: int
    student_id: int
    cover_message: Optional[str] = None
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationBulkStatusResponse(BaseModel):
    """
    Response schema for bulk application status update.
    """
    updated_count: int = Field(..., description="Number of applications updated")
    status: ApplicationStatus = Field(..., description="The new status applied")
    items: List[ApplicationResponse] = Field(..., description="List of updated application objects")
