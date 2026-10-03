from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.job_posting import JobPosting
    from app.models.user import User


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class JobInvitation(Base):
    """
    JobInvitation entity representing a recruiter's proactive invitation
    for a student candidate to apply for a specific job posting.
    """
    __tablename__ = "job_invitations"
    __table_args__ = (
        Index("ix_job_invitations_student_id_status", "student_id", "status"),
        Index("ix_job_invitations_recruiter_id_created_at", "recruiter_id", "created_at"),
        Index("ix_job_invitations_job_id_student_id", "job_id", "student_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    recruiter_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(
            InvitationStatus,
            name="invitation_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=InvitationStatus.PENDING,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    responded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    job_posting: Mapped["JobPosting"] = relationship("JobPosting", lazy="selectin")
    recruiter: Mapped["User"] = relationship("User", foreign_keys=[recruiter_id], lazy="selectin")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id], lazy="selectin")
