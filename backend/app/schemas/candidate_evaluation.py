from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.candidate_evaluation import (
    CandidateEvaluationStatus,
    CandidateRecommendation,
)


class CandidateEvaluationBase(BaseModel):
    interview_id: Optional[int] = Field(
        None,
        description="Optional ID of the specific interview round being evaluated",
    )
    technical_score: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Technical competency score (1-5)",
    )
    problem_solving_score: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Problem solving & analytical score (1-5)",
    )
    communication_score: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Communication & collaboration score (1-5)",
    )
    role_fit_score: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Role & culture fit score (1-5)",
    )
    recommendation: Optional[CandidateRecommendation] = Field(
        None,
        description="Hiring recommendation (strong_hire, hire, no_hire, strong_no_hire)",
    )
    strengths: Optional[str] = Field(
        None,
        description="Key candidate strengths observed",
    )
    areas_for_growth: Optional[str] = Field(
        None,
        description="Identified candidate development areas / concerns",
    )
    summary_notes: Optional[str] = Field(
        None,
        description="Structured private evaluator synthesis notes",
    )


class CandidateEvaluationCreate(CandidateEvaluationBase):
    is_submitted: bool = Field(
        False,
        description="If True, directly submits and finalizes evaluation; otherwise saved as DRAFT",
    )


class CandidateEvaluationUpdate(CandidateEvaluationBase):
    is_submitted: Optional[bool] = Field(
        None,
        description="If True, finalizes the draft evaluation",
    )


class CandidateEvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    interview_id: Optional[int] = None
    recruiter_id: int
    status: CandidateEvaluationStatus
    technical_score: Optional[int] = None
    problem_solving_score: Optional[int] = None
    communication_score: Optional[int] = None
    role_fit_score: Optional[int] = None
    overall_score: Optional[float] = None
    recommendation: Optional[CandidateRecommendation] = None
    strengths: Optional[str] = None
    areas_for_growth: Optional[str] = None
    summary_notes: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Metadata fields for recruiter views
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    recruiter_name: Optional[str] = None
    company_name: Optional[str] = None


class CandidateEvaluationListResponse(BaseModel):
    total: int
    items: List[CandidateEvaluationResponse]
