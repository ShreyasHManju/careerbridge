from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.innovation_project import InnovationProject
    from app.models.project_milestone import ProjectMilestone
    from app.models.project_evidence_verification import EvidenceVerification


class EvidenceType(str, enum.Enum):
    REPOSITORY = "repository"
    DOCUMENT = "document"
    IMAGE = "image"
    VIDEO = "video"
    DEMO = "demo"
    PRESENTATION = "presentation"
    LINK = "link"
    OTHER = "other"


class ProjectEvidence(Base):
    """
    ProjectEvidence entity representing tangible proof of project and milestone execution.
    Owned by the student via the parent InnovationProject. Cascades on project removal.
    """
    __tablename__ = "project_evidence"
    __table_args__ = (
        Index("ix_project_evidence_project_type", "innovation_project_id", "evidence_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    innovation_project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("innovation_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    milestone_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("project_milestones.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_type: Mapped[EvidenceType] = mapped_column(
        Enum(
            EvidenceType,
            name="evidence_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=EvidenceType.LINK,
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)

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
        back_populates="evidence_items",
    )
    milestone: Mapped[Optional["ProjectMilestone"]] = relationship(
        "ProjectMilestone",
        back_populates="evidence_items",
    )
    verification: Mapped[Optional["EvidenceVerification"]] = relationship(
        "EvidenceVerification",
        back_populates="evidence",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ProjectEvidence id={self.id} project_id={self.innovation_project_id} title={self.title!r} type={self.evidence_type.value}>"
