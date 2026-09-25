from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.experience_record import ExperienceType, VerificationSource, VerificationStatus
from app.schemas.skill import SkillResponse


class ExperienceRecordBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Title of the experience / role")
    organization_name: Optional[str] = Field(None, max_length=150, description="Name of the company, lab, or organization")
    experience_type: ExperienceType = Field(default=ExperienceType.WORK, description="Category of the experience")
    start_date: date = Field(..., description="Date when this experience started")
    end_date: Optional[date] = Field(None, description="Date when this experience concluded (None if current)")
    is_current: bool = Field(default=False, description="Whether the student is currently active in this role")
    description: str = Field(..., min_length=10, max_length=5000, description="Detailed description of responsibilities and achievements")
    skills: Optional[str] = Field(None, max_length=1000, description="Comma-separated skill names")
    innovation_project_id: Optional[int] = Field(None, description="Optional link to an owned InnovationProject")

    @model_validator(mode="after")
    def validate_dates(self) -> "ExperienceRecordBase":
        if self.end_date is not None and self.start_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on or after start_date")
        if self.is_current and self.end_date is not None:
            # If current is True, end_date should be cleared or set to None
            pass
        return self


class ExperienceRecordCreate(ExperienceRecordBase):
    """Schema for creating a new ExperienceRecord by a student."""
    status: Optional[VerificationStatus] = Field(
        default=VerificationStatus.CLAIMED,
        description="Initial status (only claimed or draft allowed on creation)",
    )

    @model_validator(mode="after")
    def validate_creation_status(self) -> "ExperienceRecordCreate":
        if self.status in [VerificationStatus.VERIFIED, VerificationStatus.PENDING_VERIFICATION]:
            raise ValueError(f"Cannot directly create an experience record with status '{self.status.value}'")
        return self


class ExperienceRecordUpdate(BaseModel):
    """Schema for updating an existing ExperienceRecord."""
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    organization_name: Optional[str] = Field(None, max_length=150)
    experience_type: Optional[ExperienceType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    skills: Optional[str] = Field(None, max_length=1000)
    innovation_project_id: Optional[int] = None
    status: Optional[VerificationStatus] = None

    @model_validator(mode="after")
    def validate_dates_and_status(self) -> "ExperienceRecordUpdate":
        if self.end_date is not None and self.start_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on or after start_date")
        if self.status in [VerificationStatus.VERIFIED, VerificationStatus.PENDING_VERIFICATION]:
            raise ValueError(f"Cannot directly set status to '{self.status.value}' via update endpoint")
        return self


class ExperienceVerificationDecision(BaseModel):
    """Schema for recruiter or admin decision on a pending verification request."""
    action: str = Field(..., description="Action to take: 'approve' or 'reject'")
    notes: Optional[str] = Field(None, max_length=2000, description="Optional feedback or audit notes")

    @model_validator(mode="after")
    def validate_action(self) -> "ExperienceVerificationDecision":
        normalized = self.action.strip().lower()
        if normalized not in ["approve", "reject"]:
            raise ValueError("action must be either 'approve' or 'reject'")
        self.action = normalized
        return self


class ExperienceRecordResponse(BaseModel):
    """Safe response schema for an ExperienceRecord."""
    id: int
    student_id: int
    title: str
    organization_name: Optional[str] = None
    experience_type: ExperienceType
    start_date: date
    end_date: Optional[date] = None
    is_current: bool
    description: str
    status: VerificationStatus
    verification_source: VerificationSource
    innovation_project_id: Optional[int] = None
    verifier_id: Optional[int] = None
    verifier_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    skills: Optional[str] = None
    structured_skills: Optional[List[SkillResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExperienceRecordListResponse(BaseModel):
    """List response for experience records."""
    items: List[ExperienceRecordResponse]
    total: int
