from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.project_milestone import MilestoneStatus


class ProjectMilestoneBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Short title describing the execution milestone")
    description: Optional[str] = Field(None, max_length=5000, description="Optional detailed description or deliverables")
    status: MilestoneStatus = Field(default=MilestoneStatus.TODO, description="Execution status (todo, in_progress, completed)")
    display_order: int = Field(default=0, ge=0, description="Deterministic display order index (non-negative integer)")
    due_date: Optional[datetime] = Field(None, description="Optional target completion date (timezone-aware)")


class ProjectMilestoneCreate(ProjectMilestoneBase):
    """Schema for creating a new milestone under an InnovationProject."""
    pass


class ProjectMilestoneUpdate(BaseModel):
    """Schema for partially updating a milestone. All fields optional."""
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=5000)
    status: Optional[MilestoneStatus] = None
    display_order: Optional[int] = Field(None, ge=0)
    due_date: Optional[datetime] = None


class ProjectMilestoneResponse(BaseModel):
    """Response schema for a single project milestone."""
    id: int
    innovation_project_id: int
    title: str
    description: Optional[str] = None
    status: MilestoneStatus
    display_order: int
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectMilestoneListResponse(BaseModel):
    """List response schema for project milestones."""
    items: List[ProjectMilestoneResponse]
    total: int
    completed: int
    progress_percentage: int
