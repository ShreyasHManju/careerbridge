from datetime import date, datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.innovation_project import InnovationProject
    from app.models.skill import Skill
    from app.models.user import User


class ExperienceType(str, enum.Enum):
    PROJECT = "project"
    INTERNSHIP = "internship"
    WORK = "work"
    RESEARCH = "research"
    LEADERSHIP = "leadership"
    CERTIFICATION = "certification"


class VerificationStatus(str, enum.Enum):
    DRAFT = "draft"
    CLAIMED = "claimed"
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"


class VerificationSource(str, enum.Enum):
    SELF_CLAIMED = "self_claimed"
    PLATFORM_PROJECT = "platform_project"
    RECRUITER_CONFIRMED = "recruiter_confirmed"
    ADMIN_CONFIRMED = "admin_confirmed"


class ExperienceRecord(Base):
    """
    ExperienceRecord entity representing a discrete student experience claim or verified achievement.
    Owned by a student User, with optional links to an InnovationProject, canonical Skills, and a verifying User.
    """
    __tablename__ = "experience_records"
    __table_args__ = (
        Index("ix_experience_records_student_status", "student_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    organization_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    experience_type: Mapped[ExperienceType] = mapped_column(
        Enum(
            ExperienceType,
            name="experience_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=ExperienceType.WORK,
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[VerificationStatus] = mapped_column(
        Enum(
            VerificationStatus,
            name="verification_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=VerificationStatus.CLAIMED,
        index=True,
        nullable=False,
    )
    verification_source: Mapped[VerificationSource] = mapped_column(
        Enum(
            VerificationSource,
            name="verification_source",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=VerificationSource.SELF_CLAIMED,
        nullable=False,
    )

    innovation_project_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("innovation_projects.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    verifier_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    student: Mapped["User"] = relationship(
        "User",
        foreign_keys=[student_id],
        back_populates="experience_records",
    )
    verifier: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[verifier_id],
    )
    innovation_project: Mapped[Optional["InnovationProject"]] = relationship(
        "InnovationProject",
        foreign_keys=[innovation_project_id],
    )
    experience_skills: Mapped[list["ExperienceSkill"]] = relationship(
        "ExperienceSkill",
        back_populates="experience_record",
        cascade="all, delete-orphan",
    )

    @property
    def structured_skills(self) -> list["Skill"]:
        """Return list of canonical Skill objects associated with this experience record."""
        return [es.skill for es in self.experience_skills if es.skill is not None]

    def __repr__(self) -> str:
        return f"<ExperienceRecord id={self.id} title={self.title!r} student_id={self.student_id} status={self.status.value}>"


class ExperienceSkill(Base):
    """
    Association table linking an ExperienceRecord to a canonical Skill.
    Cascades on experience record removal.
    """
    __tablename__ = "experience_skills"
    __table_args__ = (
        UniqueConstraint("experience_record_id", "skill_id", name="uq_experience_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    experience_record_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("experience_records.id", ondelete="CASCADE"),
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
    experience_record: Mapped["ExperienceRecord"] = relationship(
        "ExperienceRecord",
        back_populates="experience_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="experience_associations",
    )

    def __repr__(self) -> str:
        return f"<ExperienceSkill id={self.id} experience_record_id={self.experience_record_id} skill_id={self.skill_id}>"
