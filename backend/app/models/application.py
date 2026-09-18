from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.interview import Interview
    from app.models.job_posting import JobPosting
    from app.models.user import User


class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    REVIEWING = "reviewing"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    ACCEPTED = "accepted"


class Application(Base):
    """
    Application entity representing a candidate student's application to a job posting.
    Enforces a unique constraint between job_posting_id and student_id.
    """
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint(
            "job_posting_id", "student_id", name="uq_job_posting_student_application"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_posting_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    cover_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            name="application_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=ApplicationStatus.APPLIED,
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
    job_posting: Mapped["JobPosting"] = relationship(
        "JobPosting", back_populates="applications"
    )
    student: Mapped["User"] = relationship(
        "User", back_populates="applications"
    )
    interviews: Mapped[list["Interview"]] = relationship(
        "Interview", back_populates="application", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Application id={self.id} job_id={self.job_posting_id} student_id={self.student_id} status={self.status.value}>"
