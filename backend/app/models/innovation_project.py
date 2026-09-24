from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.skill import Skill
    from app.models.user import User


class ProjectType(str, enum.Enum):
    SOFTWARE = "software"
    HARDWARE = "hardware"
    RESEARCH = "research"
    ACADEMIC = "academic"
    ENTREPRENEURSHIP = "entrepreneurship"
    SOCIAL_IMPACT = "social_impact"
    OTHER = "other"


class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProjectVisibility(str, enum.Enum):
    PRIVATE = "private"
    PUBLIC = "public"


class InnovationProject(Base):
    """
    InnovationProject entity representing real-world student-built projects.
    Owned by a User with the STUDENT role.
    """
    __tablename__ = "innovation_projects"
    __table_args__ = (
        Index("ix_innovation_projects_visibility_status", "visibility", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), index=True, nullable=False)
    short_description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
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
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(
            ProjectStatus,
            name="project_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=ProjectStatus.ACTIVE,
        nullable=False,
    )
    visibility: Mapped[ProjectVisibility] = mapped_column(
        Enum(
            ProjectVisibility,
            name="project_visibility",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=ProjectVisibility.PUBLIC,
        nullable=False,
    )
    skills: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    repository_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    live_demo_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

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
    student: Mapped["User"] = relationship("User", back_populates="innovation_projects")
    project_skills: Mapped[list["ProjectSkill"]] = relationship(
        "ProjectSkill",
        back_populates="innovation_project",
        cascade="all, delete-orphan",
    )

    @property
    def structured_skills(self) -> list["Skill"]:
        """Return list of canonical Skill objects associated with this innovation project."""
        return [ps.skill for ps in self.project_skills if ps.skill is not None]

    def __repr__(self) -> str:
        return f"<InnovationProject id={self.id} title={self.title!r} student_id={self.student_id}>"


class ProjectSkill(Base):
    """
    Association table linking an InnovationProject to a canonical Skill.
    Cascades on project removal.
    """
    __tablename__ = "project_skills"
    __table_args__ = (
        UniqueConstraint("innovation_project_id", "skill_id", name="uq_project_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    innovation_project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("innovation_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    innovation_project: Mapped["InnovationProject"] = relationship(
        "InnovationProject",
        back_populates="project_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="project_associations",
    )

    def __repr__(self) -> str:
        return f"<ProjectSkill id={self.id} innovation_project_id={self.innovation_project_id} skill_id={self.skill_id}>"
