from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.job_offer import OfferStatus


class JobOfferBase(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Title or role description for the offer",
    )
    compensation: Optional[float] = Field(
        None,
        ge=0,
        description="Offered compensation or stipend amount",
    )
    currency: str = Field(
        "USD",
        min_length=1,
        max_length=10,
        description="Currency code for compensation (e.g. USD, EUR, INR)",
    )
    start_date: Optional[datetime] = Field(
        None,
        description="Proposed employment or internship start date",
    )
    expiration_date: Optional[datetime] = Field(
        None,
        description="Offer validity / expiration deadline",
    )
    terms: Optional[str] = Field(
        None,
        description="Detailed offer terms, responsibilities, or special conditions",
    )


class JobOfferCreate(JobOfferBase):
    is_sent: bool = Field(
        False,
        description="If True, directly issues and sends the offer to the candidate (status=OFFERED); otherwise saves as DRAFT",
    )


class JobOfferUpdate(BaseModel):
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=150,
        description="Updated offer title",
    )
    compensation: Optional[float] = Field(
        None,
        ge=0,
        description="Updated compensation or stipend amount",
    )
    currency: Optional[str] = Field(
        None,
        min_length=1,
        max_length=10,
        description="Updated currency code",
    )
    start_date: Optional[datetime] = Field(
        None,
        description="Updated start date",
    )
    expiration_date: Optional[datetime] = Field(
        None,
        description="Updated expiration date",
    )
    terms: Optional[str] = Field(
        None,
        description="Updated terms or conditions",
    )
    status: Optional[OfferStatus] = Field(
        None,
        description="Updated lifecycle status for the offer",
    )


class JobOfferStatusUpdate(BaseModel):
    status: OfferStatus = Field(
        ...,
        description="New lifecycle status for the job offer",
    )


class JobOfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    recruiter_id: int
    status: OfferStatus
    title: str
    compensation: Optional[float] = None
    currency: str = "USD"
    start_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    terms: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Metadata fields for views
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    recruiter_name: Optional[str] = None


class JobOfferListResponse(BaseModel):
    total: int
    items: List[JobOfferResponse]
