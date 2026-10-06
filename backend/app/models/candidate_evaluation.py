from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.interview import Interview
    from app.models.user import User


class CandidateEvaluationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


class CandidateRecommendation(str, enum.Enum):
    STRONG_HIRE = "strong_hire"
    HIRE = "hire"
    NO_HIRE = "no_hire"
    STRONG_NO_HIRE = "strong_no_hire"


class CandidateEvaluation(Base):
    """
    CandidateEvaluation entity representing a structured evaluation / scorecard
    of a student candidate's job application and/or interview, created and owned
    by an authorized Recruiter.
    """
    __tablename__ = "candidate_evaluations"
    __table_args__ = (
        Index("ix_candidate_evaluations_application_id", "application_id"),
        Index("ix_candidate_evaluations_interview_id", "interview_id"),
        Index("ix_candidate_evaluations_recruiter_id", "recruiter_id"),
        Index("ix_candidate_evaluations_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    interview_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("interviews.id", ondelete="SET NULL"),
        nullable=True,
    )
    recruiter_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[CandidateEvaluationStatus] = mapped_column(
        Enum(
            CandidateEvaluationStatus,
            name="candidate_evaluation_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=CandidateEvaluationStatus.DRAFT,
        nullable=False,
    )

    # Dimensional Scores (1 - 5)
    technical_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    problem_solving_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    communication_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    role_fit_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Server-side aggregated overall score (1.00 - 5.00)
    overall_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)

    recommendation: Mapped[Optional[CandidateRecommendation]] = mapped_column(
        Enum(
            CandidateRecommendation,
            name="candidate_recommendation",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        nullable=True,
    )

    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    areas_for_growth: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    application: Mapped["Application"] = relationship(
        "Application", back_populates="candidate_evaluations"
    )
    interview: Mapped[Optional["Interview"]] = relationship(
        "Interview", back_populates="candidate_evaluations"
    )
    recruiter: Mapped["User"] = relationship(
        "User", foreign_keys=[recruiter_id], back_populates="candidate_evaluations_as_recruiter"
    )

    def __repr__(self) -> str:
        return (
            f"<CandidateEvaluation id={self.id} app_id={self.application_id} "
            f"recruiter_id={self.recruiter_id} status={self.status.value}>"
        )
