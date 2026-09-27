from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationStatus,
    SkillAssessmentProficiency,
)


class EvaluationSkillAssessmentBase(BaseModel):
    skill_id: int = Field(..., ge=1, description="Primary key of referenced canonical Skill")
    proficiency: SkillAssessmentProficiency = Field(
        default=SkillAssessmentProficiency.NOT_OBSERVED,
        description="Assessed skill proficiency (not_observed, basic, intermediate, advanced)",
    )
    comments: Optional[str] = Field(None, max_length=255, description="Optional brief note")


class EvaluationSkillAssessmentCreate(EvaluationSkillAssessmentBase):
    pass


class EvaluationSkillAssessmentResponse(EvaluationSkillAssessmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    evaluation_id: int
    skill_name: Optional[str] = None
    skill_slug: Optional[str] = None
    skill_category: Optional[str] = None
    created_at: datetime


class ProjectEvaluationCreate(BaseModel):
    technical_quality_score: Optional[int] = Field(
        None, ge=1, le=5, description="Technical quality score (1 to 5)"
    )
    problem_solving_score: Optional[int] = Field(
        None, ge=1, le=5, description="Problem solving & architecture score (1 to 5)"
    )
    execution_score: Optional[int] = Field(
        None, ge=1, le=5, description="Execution & completeness score (1 to 5)"
    )
    communication_documentation_score: Optional[int] = Field(
        None, ge=1, le=5, description="Communication & documentation score (1 to 5)"
    )
    evidence_quality_score: Optional[int] = Field(
        None, ge=1, le=5, description="Submitted evidence quality score (1 to 5)"
    )
    recommendation: Optional[EvaluationRecommendation] = Field(
        None, description="Hiring recommendation"
    )
    strengths: Optional[str] = Field(None, description="Key candidate strengths observed")
    improvement_areas: Optional[str] = Field(None, description="Constructive areas for growth")
    feedback: Optional[str] = Field(None, description="Overall summary feedback")
    skill_assessments: Optional[List[EvaluationSkillAssessmentCreate]] = Field(
        default=None, description="Assessed canonical skills"
    )


class ProjectEvaluationUpdate(BaseModel):
    technical_quality_score: Optional[int] = Field(None, ge=1, le=5)
    problem_solving_score: Optional[int] = Field(None, ge=1, le=5)
    execution_score: Optional[int] = Field(None, ge=1, le=5)
    communication_documentation_score: Optional[int] = Field(None, ge=1, le=5)
    evidence_quality_score: Optional[int] = Field(None, ge=1, le=5)
    recommendation: Optional[EvaluationRecommendation] = None
    strengths: Optional[str] = None
    improvement_areas: Optional[str] = None
    feedback: Optional[str] = None
    skill_assessments: Optional[List[EvaluationSkillAssessmentCreate]] = None


class ProjectEvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    project_title: Optional[str] = None
    student_id: int
    student_name: Optional[str] = None
    recruiter_id: int
    recruiter_name: Optional[str] = None
    company_name: Optional[str] = None
    status: EvaluationStatus
    technical_quality_score: Optional[int] = None
    problem_solving_score: Optional[int] = None
    execution_score: Optional[int] = None
    communication_documentation_score: Optional[int] = None
    evidence_quality_score: Optional[int] = None
    overall_score: Optional[float] = None
    recommendation: Optional[EvaluationRecommendation] = None
    strengths: Optional[str] = None
    improvement_areas: Optional[str] = None
    feedback: Optional[str] = None
    skill_assessments: List[EvaluationSkillAssessmentResponse] = []
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProjectEvaluationListResponse(BaseModel):
    items: List[ProjectEvaluationResponse]
    total: int
