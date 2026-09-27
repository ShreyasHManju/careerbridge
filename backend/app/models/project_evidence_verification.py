from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project_evidence import ProjectEvidence
    from app.models.user import User


class EvidenceVerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class EvidenceVerification(Base):
    """
    EvidenceVerification entity representing foundational verification state for project evidence artifacts.
    Evaluated by authorized platform actors (e.g. Admin), never self-approved by the owning student.
    Cascades on parent ProjectEvidence removal.
    """
    __tablename__ = "project_evidence_verifications"
    __table_args__ = (
        Index("ix_evidence_verifications_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evidence_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_evidence.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    verifier_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    status: Mapped[EvidenceVerificationStatus] = mapped_column(
        Enum(
            EvidenceVerificationStatus,
            name="evidence_verification_status",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=EvidenceVerificationStatus.PENDING,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    evidence: Mapped["ProjectEvidence"] = relationship(
        "ProjectEvidence",
        back_populates="verification",
    )
    verifier: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[verifier_id],
    )

    def __repr__(self) -> str:
        return f"<EvidenceVerification id={self.id} evidence_id={self.evidence_id} status={self.status.value}>"
