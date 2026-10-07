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
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class OfferStatus(str, enum.Enum):
    DRAFT = "draft"
    OFFERED = "offered"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


class JobOffer(Base):
    """
    JobOffer entity representing an official job/internship offer extended
    by an authorized Recruiter to a candidate student for a specific Application.
    Enforces a strict 1-to-1 unique relationship with Application for V1.
    """
    __tablename__ = "job_offers"
    __table_args__ = (
        Index("ix_job_offers_application_id", "application_id", unique=True),
        Index("ix_job_offers_recruiter_id", "recruiter_id"),
        Index("ix_job_offers_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    recruiter_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[OfferStatus] = mapped_column(
        Enum(
            OfferStatus,
            name="offer_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=OfferStatus.DRAFT,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    compensation: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(10),
        default="USD",
        server_default="USD",
        nullable=False,
    )

    start_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expiration_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
        "Application", back_populates="job_offer"
    )
    recruiter: Mapped["User"] = relationship(
        "User", foreign_keys=[recruiter_id], back_populates="job_offers_as_recruiter"
    )

    def __repr__(self) -> str:
        return (
            f"<JobOffer id={self.id} app_id={self.application_id} "
            f"recruiter_id={self.recruiter_id} status={self.status.value}>"
        )
