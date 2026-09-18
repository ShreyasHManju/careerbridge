from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class NotificationType(str, enum.Enum):
    APPLICATION_SUBMITTED = "application_submitted"
    APPLICATION_STATUS_CHANGED = "application_status_changed"
    RECRUITER_VERIFICATION_CHANGED = "recruiter_verification_changed"
    JOB_MODERATION_CHANGED = "job_moderation_changed"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_RESCHEDULED = "interview_rescheduled"
    INTERVIEW_CANCELLED = "interview_cancelled"
    MESSAGE_RECEIVED = "message_received"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(
            NotificationType,
            name="notification_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=sa.text("false"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Many-to-one relationship with User
    user: Mapped["User"] = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user_id_is_read", "user_id", "is_read"),
        Index("ix_notifications_user_id_created_at", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.notification_type} is_read={self.is_read}>"
