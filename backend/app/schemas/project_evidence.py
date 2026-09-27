from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.models.project_evidence import EvidenceType


class ProjectEvidenceBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Evidence artifact title (e.g., GitHub Repo, Live Demo, Whitepaper)")
    description: Optional[str] = Field(None, max_length=2000, description="Detailed description of the evidence artifact and its relevance")
    evidence_type: EvidenceType = Field(default=EvidenceType.LINK, description="Category of evidence artifact (repository, document, image, video, demo, presentation, link, other)")
    url: str = Field(..., min_length=3, max_length=500, description="Web URL or resource URI pointing to the evidence artifact")
    milestone_id: Optional[int] = Field(None, ge=1, description="Optional milestone identifier if evidence directly attaches to a project milestone")

    @field_validator("title", mode="before")
    @classmethod
    def sanitize_title(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Evidence title cannot be blank or empty whitespace.")
        return v

    @field_validator("url", mode="before")
    @classmethod
    def validate_url_format(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if not (v.startswith("http://") or v.startswith("https://") or v.startswith("ftp://") or v.startswith("file://") or v.startswith("ipfs://")):
                raise ValueError("Evidence URL must start with a valid URI scheme (e.g. https://, http://, ipfs://).")
        return v


class ProjectEvidenceCreate(ProjectEvidenceBase):
    pass


class ProjectEvidenceUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    evidence_type: Optional[EvidenceType] = None
    url: Optional[str] = Field(None, min_length=3, max_length=500)
    milestone_id: Optional[int] = Field(None, ge=1)

    @field_validator("title", mode="before")
    @classmethod
    def sanitize_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Evidence title cannot be blank or whitespace.")
        return v

    @field_validator("url", mode="before")
    @classmethod
    def validate_url_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not (v.startswith("http://") or v.startswith("https://") or v.startswith("ftp://") or v.startswith("file://") or v.startswith("ipfs://")):
                raise ValueError("Evidence URL must start with a valid URI scheme (e.g. https://, http://).")
        return v


class ProjectEvidenceResponse(ProjectEvidenceBase):
    id: int
    innovation_project_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectEvidenceListResponse(BaseModel):
    project_id: int
    total_count: int
    items: List[ProjectEvidenceResponse]
