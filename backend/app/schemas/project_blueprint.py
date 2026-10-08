from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.innovation_project import ProjectType
from app.models.project_blueprint import BlueprintDifficulty, BlueprintStatus
from app.models.project_evidence import EvidenceType
from app.schemas.skill import SkillResponse


class BlueprintSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skill_id: int
    name: str
    slug: str
    category: Optional[str] = None
    is_primary: bool = True


class BlueprintMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    expected_deliverable: str
    recommended_evidence_type: str
    evidence_guidance: Optional[str] = None
    display_order: int
    created_at: datetime


class ProjectBlueprintSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    version: int = 1
    summary: str
    project_type: str
    difficulty_level: str
    estimated_hours: int
    status: str
    skills: List[BlueprintSkillResponse] = Field(default_factory=list)
    milestones_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectBlueprintDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    version: int = 1
    summary: str
    description: str
    learning_objectives: str
    project_type: str
    difficulty_level: str
    estimated_hours: int
    status: str
    skills: List[BlueprintSkillResponse] = Field(default_factory=list)
    milestones: List[BlueprintMilestoneResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProjectBlueprintPaginationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[ProjectBlueprintSummaryResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class MatchedMissingSkillItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_primary: bool = True


class BlueprintRecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    blueprint: ProjectBlueprintSummaryResponse
    matched_missing_skills: List[MatchedMissingSkillItem]
    missing_primary_count: int
    missing_supporting_count: int
    total_missing_covered: int
    relevance_score: int
    recommendation_reason: str


class JobProjectRecommendationsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: int
    job_title: str
    total_missing_skills: int
    missing_skills: List[SkillResponse]
    recommendations: List[BlueprintRecommendationItem]


class SkillProjectRecommendationsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    target_skill_ids: List[int]
    total_blueprints_found: int
    recommendations: List[BlueprintRecommendationItem]
