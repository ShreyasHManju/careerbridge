from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.innovation_project import ProjectType
from app.models.project_evidence import EvidenceType

if TYPE_CHECKING:
    from app.models.innovation_project import InnovationProject
    from app.models.skill import Skill


class BlueprintDifficulty(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class BlueprintStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ProjectBlueprint(Base):
    """
    ProjectBlueprint entity representing authoritative, curated engineering project blueprints.
    Authored by the platform / admins to guide students in developing and proving target skills.
    """
    __tablename__ = "project_blueprints"
    __table_args__ = (
        Index("ix_project_blueprints_status", "status"),
        Index("ix_project_blueprints_type_diff", "project_type", "difficulty_level", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    summary: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    learning_objectives: Mapped[str] = mapped_column(Text, nullable=False)
    project_type: Mapped[ProjectType] = mapped_column(
        Enum(
            ProjectType,
            name="project_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=ProjectType.SOFTWARE,
        nullable=False,
    )
    difficulty_level: Mapped[BlueprintDifficulty] = mapped_column(
        Enum(
            BlueprintDifficulty,
            name="blueprint_difficulty",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=BlueprintDifficulty.INTERMEDIATE,
        nullable=False,
    )
    estimated_hours: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    status: Mapped[BlueprintStatus] = mapped_column(
        Enum(
            BlueprintStatus,
            name="blueprint_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=BlueprintStatus.PUBLISHED,
        nullable=False,
    )

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
    blueprint_skills: Mapped[list["ProjectBlueprintSkill"]] = relationship(
        "ProjectBlueprintSkill",
        back_populates="blueprint",
        cascade="all, delete-orphan",
        order_by="ProjectBlueprintSkill.is_primary.desc(), ProjectBlueprintSkill.id.asc()",
    )
    milestones: Mapped[list["ProjectBlueprintMilestone"]] = relationship(
        "ProjectBlueprintMilestone",
        back_populates="blueprint",
        cascade="all, delete-orphan",
        order_by="ProjectBlueprintMilestone.display_order.asc()",
    )
    instantiated_projects: Mapped[list["InnovationProject"]] = relationship(
        "InnovationProject",
        back_populates="source_blueprint",
        passive_deletes="all",
    )

    def __repr__(self) -> str:
        return f"<ProjectBlueprint id={self.id} title={self.title!r} version={self.version} status={self.status.value}>"


class ProjectBlueprintSkill(Base):
    """
    Associative table linking a ProjectBlueprint to a canonical Skill.
    Distinguishes primary skills (intentionally taught/proven) from supporting tooling.
    """
    __tablename__ = "project_blueprint_skills"
    __table_args__ = (
        UniqueConstraint("blueprint_id", "skill_id", name="uq_blueprint_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    blueprint_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_blueprints.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    blueprint: Mapped["ProjectBlueprint"] = relationship(
        "ProjectBlueprint",
        back_populates="blueprint_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
    )

    def __repr__(self) -> str:
        return f"<ProjectBlueprintSkill id={self.id} blueprint_id={self.blueprint_id} skill_id={self.skill_id} is_primary={self.is_primary}>"


class ProjectBlueprintMilestone(Base):
    """
    Milestone definition template for a ProjectBlueprint.
    Contains concrete deliverables, recommended evidence types, and actionable evidence guidance.
    """
    __tablename__ = "project_blueprint_milestones"
    __table_args__ = (
        Index("ix_blueprint_milestones_blueprint_order", "blueprint_id", "display_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    blueprint_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_blueprints.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    expected_deliverable: Mapped[str] = mapped_column(String(300), nullable=False)
    recommended_evidence_type: Mapped[EvidenceType] = mapped_column(
        Enum(
            EvidenceType,
            name="evidence_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=EvidenceType.REPOSITORY,
        nullable=False,
    )
    evidence_guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    blueprint: Mapped["ProjectBlueprint"] = relationship(
        "ProjectBlueprint",
        back_populates="milestones",
    )

    def __repr__(self) -> str:
        return f"<ProjectBlueprintMilestone id={self.id} blueprint_id={self.blueprint_id} title={self.title!r} order={self.display_order}>"
