from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.skill import SkillResponse


class StudentProfileCreate(BaseModel):
    """
    Schema for creating a new StudentProfile.
    The owning user_id is NOT accepted from the client; it is securely derived from current_user.id.
    """
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of the student")
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    college: Optional[str] = Field(None, max_length=150, description="College / University name")
    degree: Optional[str] = Field(None, max_length=100, description="Degree or program (e.g. B.Tech, B.S., M.S.)")
    branch: Optional[str] = Field(None, max_length=100, description="Branch / Major (e.g. Computer Science)")
    graduation_year: Optional[int] = Field(None, ge=1900, le=2100, description="Graduation year (e.g. 2026)")
    bio: Optional[str] = Field(None, max_length=1000, description="Short professional bio or objective")
    skills: Optional[str] = Field(None, max_length=1000, description="Skills (e.g. Python, React, PostgreSQL)")
    github_url: Optional[str] = Field(None, max_length=255, description="GitHub profile URL")
    linkedin_url: Optional[str] = Field(None, max_length=255, description="LinkedIn profile URL")
    portfolio_url: Optional[str] = Field(None, max_length=255, description="Portfolio or personal website URL")


class StudentProfileUpdate(BaseModel):
    """
    Schema for partially updating an existing StudentProfile.
    All fields are optional; ownership (user_id) cannot be modified.
    """
    full_name: Optional[str] = Field(None, min_length=2, max_length=100, description="Full name of the student")
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    college: Optional[str] = Field(None, max_length=150, description="College / University name")
    degree: Optional[str] = Field(None, max_length=100, description="Degree or program")
    branch: Optional[str] = Field(None, max_length=100, description="Branch / Major")
    graduation_year: Optional[int] = Field(None, ge=1900, le=2100, description="Graduation year")
    bio: Optional[str] = Field(None, max_length=1000, description="Short professional bio")
    skills: Optional[str] = Field(None, max_length=1000, description="Skills")
    github_url: Optional[str] = Field(None, max_length=255, description="GitHub profile URL")
    linkedin_url: Optional[str] = Field(None, max_length=255, description="LinkedIn profile URL")
    portfolio_url: Optional[str] = Field(None, max_length=255, description="Portfolio or personal website URL")


class StudentProfileResponse(BaseModel):
    """
    Safe public response schema for StudentProfile.
    Excludes sensitive internal credentials while preserving legacy skills string and optional structured skills.
    """
    id: int
    user_id: int
    full_name: str
    phone: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    structured_skills: Optional[List[SkillResponse]] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
