from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.interview import InterviewStatus, InterviewType


class InterviewCreate(BaseModel):
    """
    Schema for creating a new interview for a job application.
    Recruiter-only input; ownership fields are derived from the session and application.
    """
    scheduled_at: datetime = Field(
        ...,
        description="Scheduled date and time of the interview (ISO 8601 with timezone or UTC)",
    )
    duration_minutes: int = Field(
        ...,
        ge=1,
        le=480,
        description="Duration of interview in minutes (1 to 480)",
    )
    interview_type: InterviewType = Field(
        InterviewType.ONLINE,
        description="Interview medium: online, in_person, or phone",
    )
    location_or_link: Optional[str] = Field(
        None,
        max_length=500,
        description="Meeting URL link or physical room/address location",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional interview agenda, instructions, or notes for the candidate",
    )


class InterviewUpdate(BaseModel):
    """
    Schema for updating or rescheduling an existing interview.
    All fields are optional; ownership and identifiers are immutable.
    """
    scheduled_at: Optional[datetime] = Field(
        None,
        description="Updated scheduled date and time of the interview",
    )
    duration_minutes: Optional[int] = Field(
        None,
        ge=1,
        le=480,
        description="Updated duration of interview in minutes",
    )
    interview_type: Optional[InterviewType] = Field(
        None,
        description="Updated interview medium",
    )
    location_or_link: Optional[str] = Field(
        None,
        max_length=500,
        description="Updated meeting link or address",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Updated notes",
    )
    status: Optional[InterviewStatus] = Field(
        None,
        description="Updated interview status: scheduled, completed, cancelled, rescheduled",
    )


class InterviewResponse(BaseModel):
    """
    Response schema for interview details including job and participant metadata.
    """
    id: int = Field(..., description="Unique interview identifier")
    application_id: int = Field(..., description="Referenced application ID")
    recruiter_id: int = Field(..., description="Referenced recruiter user ID")
    student_id: int = Field(..., description="Referenced candidate student user ID")
    job_id: Optional[int] = Field(None, description="Referenced job posting ID")
    job_title: Optional[str] = Field(None, description="Title of the job posting")
    company_name: Optional[str] = Field(None, description="Company hosting the interview")
    candidate_email: Optional[str] = Field(None, description="Candidate student email")
    recruiter_email: Optional[str] = Field(None, description="Hiring recruiter email")
    scheduled_at: datetime = Field(..., description="Scheduled timestamp")
    duration_minutes: int = Field(..., description="Interview duration in minutes")
    interview_type: InterviewType = Field(..., description="Type/medium of interview")
    location_or_link: Optional[str] = Field(None, description="Meeting link or location")
    notes: Optional[str] = Field(None, description="Interview notes")
    status: InterviewStatus = Field(..., description="Lifecycle status of the interview")
    created_at: datetime = Field(..., description="Timestamp when interview was created")
    updated_at: datetime = Field(..., description="Timestamp when interview was last updated")

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_interview(cls, interview: Any) -> "InterviewResponse":
        job = None
        if hasattr(interview, "application") and interview.application:
            job = getattr(interview.application, "job_posting", None)

        candidate_email = (
            interview.student.email if getattr(interview, "student", None) else None
        )
        recruiter_email = (
            interview.recruiter.email if getattr(interview, "recruiter", None) else None
        )

        return cls(
            id=interview.id,
            application_id=interview.application_id,
            recruiter_id=interview.recruiter_id,
            student_id=interview.student_id,
            job_id=job.id if job else None,
            job_title=job.title if job else None,
            company_name=job.company_name if job else None,
            candidate_email=candidate_email,
            recruiter_email=recruiter_email,
            scheduled_at=interview.scheduled_at,
            duration_minutes=interview.duration_minutes,
            interview_type=interview.interview_type,
            location_or_link=interview.location_or_link,
            notes=interview.notes,
            status=interview.status,
            created_at=interview.created_at,
            updated_at=interview.updated_at,
        )
