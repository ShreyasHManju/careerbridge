from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User



class OpportunityType(str, enum.Enum):
    INTERNSHIP = "internship"
    JOB = "job"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"


class JobPosting(Base):
    """
    JobPosting entity representing job or internship opportunities posted by recruiters.
    Connected many-to-one to User (holding the RECRUITER role).
    """
    __tablename__ = "job_postings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recruiter_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    opportunity_type: Mapped[OpportunityType] = mapped_column(
        Enum(
            OpportunityType,
            name="opportunity_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        nullable=False,
    )
    company_name: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    is_remote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    employment_type: Mapped[EmploymentType] = mapped_column(
        Enum(
            EmploymentType,
            name="employment_type",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        nullable=False,
    )
    skills: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    minimum_qualification: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    experience_required: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    application_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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

    # Many-to-one relationship back to the recruiter User
    recruiter: Mapped["User"] = relationship("User", back_populates="job_postings")

    # One-to-many relationship with Application
    applications: Mapped[list["Application"]] = relationship(
        "Application",
        back_populates="job_posting",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<JobPosting id={self.id} title={self.title!r} company={self.company_name!r} recruiter_id={self.recruiter_id}>"

