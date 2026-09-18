from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserResponse


class AdminUserStatusUpdate(BaseModel):
    """
    Schema for activating or deactivating a user account by an administrator.
    """
    is_active: bool = Field(..., description="Target active status for the user account")


class AdminUserPaginationResponse(BaseModel):
    """
    Paginated envelope response schema for administrative user listings.
    """
    items: List[UserResponse]
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total: int = Field(..., description="Total count of users matching filter criteria")
    total_pages: int = Field(..., description="Total pages available")

    model_config = ConfigDict(from_attributes=True)


class AdminRecruiterResponse(BaseModel):
    """
    Safe administrative response schema for recruiter profile review and verification.
    """
    id: int
    user_id: int
    email: Optional[str] = None
    company_name: str
    company_description: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    company_website: Optional[str] = None
    company_location: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminRecruiterVerificationUpdate(BaseModel):
    """
    Schema for verifying or unverifying a recruiter by an administrator.
    """
    is_verified: bool = Field(..., description="Target verification status for the recruiter")


class AdminRecruiterPaginationResponse(BaseModel):
    """
    Paginated envelope response schema for administrative recruiter listings.
    """
    items: List[AdminRecruiterResponse]
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total: int = Field(..., description="Total count of recruiters matching filter criteria")
    total_pages: int = Field(..., description="Total pages available")

    model_config = ConfigDict(from_attributes=True)


class AdminJobStatusUpdate(BaseModel):
    """
    Schema for activating or deactivating a job posting by an administrator.
    """
    is_active: bool = Field(..., description="Target active status for the job posting")
