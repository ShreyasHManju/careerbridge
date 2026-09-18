from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class InterviewType(str, enum.Enum):
    ONLINE = "online"
    IN_PERSON = "in_person"
    PHONE = "phone"


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class Interview(Base):
    """
    Interview entity representing an interview scheduled between a recruiter and a candidate student
    for an active application.
    """
    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recruiter_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    interview_type: Mapped[InterviewType] = mapped_column(
        Enum(
            InterviewType,
            name="interview_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=InterviewType.ONLINE,
        nullable=False,
    )
    location_or_link: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[InterviewStatus] = mapped_column(
        Enum(
            InterviewStatus,
            name="interview_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=InterviewStatus.SCHEDULED,
        nullable=False,
        index=True,
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
        "Application", back_populates="interviews"
    )
    recruiter: Mapped["User"] = relationship(
        "User", foreign_keys=[recruiter_id], back_populates="interviews_as_recruiter"
    )
    student: Mapped["User"] = relationship(
        "User", foreign_keys=[student_id], back_populates="interviews_as_student"
    )

    __table_args__ = (
        Index("ix_interviews_recruiter_id_scheduled_at", "recruiter_id", "scheduled_at"),
        Index("ix_interviews_student_id_scheduled_at", "student_id", "scheduled_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Interview id={self.id} app_id={self.application_id} "
            f"recruiter_id={self.recruiter_id} student_id={self.student_id} status={self.status.value}>"
        )
