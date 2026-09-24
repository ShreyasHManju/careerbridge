from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.student_profile import StudentProfile
    from app.models.job_posting import JobPosting
    from app.models.innovation_project import ProjectSkill


class Skill(Base):
    """
    Canonical master Skill entity.
    Stores normalized skill records with a unique slug and optional category.
    """
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    student_associations: Mapped[list["StudentSkill"]] = relationship(
        "StudentSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    job_associations: Mapped[list["JobSkill"]] = relationship(
        "JobSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    project_associations: Mapped[list["ProjectSkill"]] = relationship(
        "ProjectSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Skill id={self.id} name={self.name!r} slug={self.slug!r}>"


class StudentSkill(Base):
    """
    Association table linking a StudentProfile to a canonical Skill.
    Includes optional proficiency and strict student profile scoping.
    """
    __tablename__ = "student_skills"
    __table_args__ = (
        UniqueConstraint("student_profile_id", "skill_id", name="uq_student_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_profile_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    proficiency: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    student_profile: Mapped["StudentProfile"] = relationship(
        "StudentProfile",
        back_populates="student_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="student_associations",
    )

    def __repr__(self) -> str:
        return f"<StudentSkill id={self.id} student_profile_id={self.student_profile_id} skill_id={self.skill_id}>"


class JobSkill(Base):
    """
    Association table linking a JobPosting to a canonical Skill.
    Includes is_required flag and cascading deletion on job removal.
    """
    __tablename__ = "job_skills"
    __table_args__ = (
        UniqueConstraint("job_posting_id", "skill_id", name="uq_job_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_posting_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    job_posting: Mapped["JobPosting"] = relationship(
        "JobPosting",
        back_populates="job_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="job_associations",
    )

    def __repr__(self) -> str:
        return f"<JobSkill id={self.id} job_posting_id={self.job_posting_id} skill_id={self.skill_id}>"
