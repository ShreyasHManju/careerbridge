from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.innovation_project import InnovationProject


class MilestoneStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ProjectMilestone(Base):
    """
    ProjectMilestone entity representing measurable execution steps for an InnovationProject.
    Cascades on project removal.
    """
    __tablename__ = "project_milestones"
    __table_args__ = (
        Index("ix_project_milestones_project_order", "innovation_project_id", "display_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    innovation_project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("innovation_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(
            MilestoneStatus,
            name="milestone_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=MilestoneStatus.TODO,
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    innovation_project: Mapped["InnovationProject"] = relationship(
        "InnovationProject",
        back_populates="milestones",
    )

    def __repr__(self) -> str:
        return f"<ProjectMilestone id={self.id} project_id={self.innovation_project_id} title={self.title!r} status={self.status.value}>"
