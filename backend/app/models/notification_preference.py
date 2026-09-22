from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class NotificationFrequency(str, enum.Enum):
    INSTANT = "instant"
    DIGEST = "digest"


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    frequency: Mapped[NotificationFrequency] = mapped_column(
        Enum(
            NotificationFrequency,
            name="notification_frequency",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=NotificationFrequency.INSTANT,
        server_default="instant",
        nullable=False,
    )
    email_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=sa.text("true"),
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

    # Relationship to User
    user: Mapped["User"] = relationship("User", back_populates="notification_preference")

    def __repr__(self) -> str:
        return f"<NotificationPreference user_id={self.user_id} frequency={self.frequency} email_notifications={self.email_notifications}>"
