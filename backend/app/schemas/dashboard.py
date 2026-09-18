from typing import List
from pydantic import BaseModel, ConfigDict, Field


class StudentDashboardResponse(BaseModel):
    """
    Aggregated metrics for authenticated student dashboard.
    All data is strictly scoped to the authenticated student user.
    """
    model_config = ConfigDict(from_attributes=True)

    total_applications: int = Field(
        ...,
        ge=0,
        description="Total number of job and internship applications submitted by this student",
    )
    applications_under_review: int = Field(
        ...,
        ge=0,
        description="Number of applications currently in 'reviewing' status",
    )
    shortlisted_applications: int = Field(
        ...,
        ge=0,
        description="Number of applications that have been shortlisted by recruiters",
    )
    accepted_applications: int = Field(
        ...,
        ge=0,
        description="Number of applications accepted by hiring organizations",
    )
    saved_internships: int = Field(
        ...,
        ge=0,
        description="Total number of active opportunities saved or bookmarked by this student",
    )
    upcoming_interviews: int = Field(
        ...,
        ge=0,
        description="Number of scheduled interviews in the future for this student",
    )


class RecruiterDashboardResponse(BaseModel):
    """
    Aggregated metrics for authenticated company/recruiter dashboard.
    All data is strictly scoped to opportunities owned by this recruiter.
    """
    model_config = ConfigDict(from_attributes=True)

    active_internships: int = Field(
        ...,
        ge=0,
        description="Number of active/published job and internship postings owned by this recruiter",
    )
    total_applications: int = Field(
        ...,
        ge=0,
        description="Total applications submitted to all opportunities posted by this recruiter",
    )
    applications_awaiting_review: int = Field(
        ...,
        ge=0,
        description="Applications received in 'applied' status awaiting initial recruiter evaluation",
    )
    shortlisted_candidates: int = Field(
        ...,
        ge=0,
        description="Candidate applications that have been advanced to 'shortlisted' status",
    )
    scheduled_interviews: int = Field(
        ...,
        ge=0,
        description="Total scheduled or rescheduled interviews associated with this recruiter's opportunities",
    )


class MonthlyRegistrationMetric(BaseModel):
    """
    User registration count aggregated by calendar month.
    """
    model_config = ConfigDict(from_attributes=True)

    month: str = Field(
        ...,
        description="Calendar month in 'YYYY-MM' format",
    )
    count: int = Field(
        ...,
        ge=0,
        description="Number of newly registered user accounts in this month",
    )


class AdminDashboardResponse(BaseModel):
    """
    Platform-wide administrative metrics and growth indicators.
    """
    model_config = ConfigDict(from_attributes=True)

    total_students: int = Field(
        ...,
        ge=0,
        description="Total registered user accounts with the student role",
    )
    total_companies: int = Field(
        ...,
        ge=0,
        description="Total registered user accounts with the recruiter role",
    )
    verified_companies: int = Field(
        ...,
        ge=0,
        description="Number of recruiter organizations that have been verified by administrators",
    )
    published_internships: int = Field(
        ...,
        ge=0,
        description="Total active/published opportunities currently open across the platform",
    )
    total_applications: int = Field(
        ...,
        ge=0,
        description="Total application submissions across all platform opportunities",
    )
    application_success_rate: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Percentage of applications resulting in acceptance (accepted / total * 100)",
    )
    monthly_registrations: List[MonthlyRegistrationMetric] = Field(
        default_factory=list,
        description="Monthly account registration counts for the current calendar year",
    )
