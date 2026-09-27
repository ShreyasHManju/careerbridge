from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project_evidence_verification import EvidenceVerificationStatus


class EvidenceVerificationBase(BaseModel):
    status: EvidenceVerificationStatus = Field(
        default=EvidenceVerificationStatus.VERIFIED,
        description="Verification decision for the project evidence (verified or rejected)",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Detailed review feedback or justification for the verification decision",
    )

    @field_validator("notes", mode="before")
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and isinstance(v, str):
            v = v.strip()
            if not v:
                return None
        return v


class EvidenceVerificationCreate(EvidenceVerificationBase):
    pass


class EvidenceVerificationUpdate(BaseModel):
    status: Optional[EvidenceVerificationStatus] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and isinstance(v, str):
            v = v.strip()
            if not v:
                return None
        return v


class EvidenceVerificationResponse(BaseModel):
    id: int
    evidence_id: int
    verifier_id: Optional[int] = None
    status: EvidenceVerificationStatus
    notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
