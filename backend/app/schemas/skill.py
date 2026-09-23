from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SkillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Canonical skill name")
    category: Optional[str] = Field(None, max_length=50, description="Skill category (e.g. Frontend, Backend, DevOps)")


class SkillCreate(SkillBase):
    """Schema for adding a skill to the canonical catalog."""
    pass


class SkillResponse(BaseModel):
    """Safe response schema for a canonical Skill entity."""
    id: int
    name: str
    slug: str
    category: Optional[str] = None
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentSkillResponse(BaseModel):
    """Response schema for a student-skill association."""
    id: int
    skill_id: int
    name: str
    slug: str
    category: Optional[str] = None
    proficiency: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobSkillResponse(BaseModel):
    """Response schema for a job-skill association."""
    id: int
    skill_id: int
    name: str
    slug: str
    category: Optional[str] = None
    is_required: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
