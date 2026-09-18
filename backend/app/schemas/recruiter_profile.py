from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class RecruiterProfileCreate(BaseModel):
    """
    Schema for creating a new RecruiterProfile.
    The owning user_id is NOT accepted from the client; it is securely derived from current_user.id.
    """
    company_name: str = Field(
        ..., min_length=2, max_length=150, description="Company / Organization name"
    )
    company_description: Optional[str] = Field(
        None, max_length=2000, description="Overview of the company"
    )
    contact_name: Optional[str] = Field(
        None, min_length=2, max_length=100, description="Recruiter contact person name"
    )
    phone: Optional[str] = Field(
        None, max_length=20, description="Contact phone number"
    )
    company_website: Optional[str] = Field(
        None, max_length=255, description="Official company website URL"
    )
    company_location: Optional[str] = Field(
        None, max_length=150, description="Headquarters or office location"
    )
    industry: Optional[str] = Field(
        None, max_length=100, description="Industry sector (e.g. Technology, Finance, Healthcare)"
    )
    company_size: Optional[str] = Field(
        None, max_length=50, description="Company size range (e.g. 1-10, 11-50, 51-200, 500+)"
    )


class RecruiterProfileUpdate(BaseModel):
    """
    Schema for partially updating an existing RecruiterProfile.
    All fields are optional; ownership (user_id) cannot be modified.
    """
    company_name: Optional[str] = Field(
        None, min_length=2, max_length=150, description="Company / Organization name"
    )
    company_description: Optional[str] = Field(
        None, max_length=2000, description="Overview of the company"
    )
    contact_name: Optional[str] = Field(
        None, min_length=2, max_length=100, description="Recruiter contact person name"
    )
    phone: Optional[str] = Field(
        None, max_length=20, description="Contact phone number"
    )
    company_website: Optional[str] = Field(
        None, max_length=255, description="Official company website URL"
    )
    company_location: Optional[str] = Field(
        None, max_length=150, description="Headquarters or office location"
    )
    industry: Optional[str] = Field(
        None, max_length=100, description="Industry sector"
    )
    company_size: Optional[str] = Field(
        None, max_length=50, description="Company size range"
    )


class RecruiterProfileResponse(BaseModel):
    """
    Safe public response schema for RecruiterProfile.
    Excludes sensitive internal credentials, passwords, and tokens.
    """
    id: int
    user_id: int
    company_name: str
    company_description: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    company_website: Optional[str] = None
    company_location: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    is_verified: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
