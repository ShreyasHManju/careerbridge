from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.innovation_project import InnovationProject
    from app.models.skill import Skill
    from app.models.user import User


class EvaluationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    WITHDRAWN = "withdrawn"


class EvaluationRecommendation(str, enum.Enum):
    NOT_RECOMMENDED = "not_recommended"
    DEVELOPING = "developing"
    RECOMMENDED = "recommended"
    STRONGLY_RECOMMENDED = "strongly_recommended"


class SkillAssessmentProficiency(str, enum.Enum):
    NOT_OBSERVED = "not_observed"
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ProjectEvaluation(Base):
    """
    ProjectEvaluation entity representing a structured evaluation of a student's
    InnovationProject submitted by an authorized Recruiter.
    """
    __tablename__ = "project_evaluations"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "recruiter_id", name="uq_project_recruiter_evaluation"
        ),
        Index("ix_project_evaluations_status", "status"),
        Index("ix_project_evaluations_student_id", "student_id"),
        Index("ix_project_evaluations_recruiter_id", "recruiter_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("innovation_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    recruiter_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    status: Mapped[EvaluationStatus] = mapped_column(
        Enum(
            EvaluationStatus,
            name="evaluation_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=EvaluationStatus.DRAFT,
        nullable=False,
    )

    # Dimensional Scores (1 - 5)
    technical_quality_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    problem_solving_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    execution_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    communication_documentation_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    evidence_quality_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Server-side aggregated overall score (1.00 - 5.00)
    overall_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)

    recommendation: Mapped[Optional[EvaluationRecommendation]] = mapped_column(
        Enum(
            EvaluationRecommendation,
            name="evaluation_recommendation",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        nullable=True,
    )

    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    improvement_areas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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
    project: Mapped["InnovationProject"] = relationship(
        "InnovationProject", back_populates="evaluations"
    )
    student: Mapped["User"] = relationship(
        "User", foreign_keys=[student_id], back_populates="evaluations_as_student"
    )
    recruiter: Mapped["User"] = relationship(
        "User", foreign_keys=[recruiter_id], back_populates="evaluations_as_recruiter"
    )
    skill_assessments: Mapped[list["EvaluationSkillAssessment"]] = relationship(
        "EvaluationSkillAssessment",
        back_populates="evaluation",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<ProjectEvaluation id={self.id} project_id={self.project_id} "
            f"recruiter_id={self.recruiter_id} status={self.status.value}>"
        )


class EvaluationSkillAssessment(Base):
    """
    Assessment of a specific canonical Skill within a ProjectEvaluation.
    Reuses the master Skill table.
    """
    __tablename__ = "evaluation_skill_assessments"
    __table_args__ = (
        UniqueConstraint("evaluation_id", "skill_id", name="uq_evaluation_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evaluation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_evaluations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    proficiency: Mapped[SkillAssessmentProficiency] = mapped_column(
        Enum(
            SkillAssessmentProficiency,
            name="skill_assessment_proficiency",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=SkillAssessmentProficiency.NOT_OBSERVED,
        nullable=False,
    )
    comments: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    evaluation: Mapped["ProjectEvaluation"] = relationship(
        "ProjectEvaluation", back_populates="skill_assessments"
    )
    skill: Mapped["Skill"] = relationship(
        "Skill", back_populates="evaluation_assessments"
    )

    def __repr__(self) -> str:
        return (
            f"<EvaluationSkillAssessment id={self.id} evaluation_id={self.evaluation_id} "
            f"skill_id={self.skill_id} proficiency={self.proficiency.value}>"
        )
