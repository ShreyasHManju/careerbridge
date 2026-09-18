from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.job_posting import JobPosting
    from app.models.user import User


class SavedJob(Base):
    """
    SavedJob entity representing a job or internship posting bookmarked by an authenticated student.
    Enforces a unique constraint between student_id and job_posting_id to prevent duplicates.
    """
    __tablename__ = "saved_jobs"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "job_posting_id", name="uq_saved_job_student_job"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_posting_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    student: Mapped["User"] = relationship(
        "User", back_populates="saved_jobs"
    )
    job_posting: Mapped["JobPosting"] = relationship(
        "JobPosting", back_populates="saved_jobs"
    )

    def __repr__(self) -> str:
        return f"<SavedJob id={self.id} student_id={self.student_id} job_posting_id={self.job_posting_id}>"
