from datetime import datetime
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.job_posting import JobPosting
    from app.models.profile_image import ProfileImage
    from app.models.recruiter_profile import RecruiterProfile
    from app.models.resume import Resume
    from app.models.saved_job import SavedJob
    from app.models.student_profile import StudentProfile





class UserRole(str, enum.Enum):
    STUDENT = "student"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
        ),
        default=UserRole.STUDENT,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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

    # One-to-one relationship with StudentProfile
    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # One-to-one relationship with RecruiterProfile
    recruiter_profile: Mapped[Optional["RecruiterProfile"]] = relationship(
        "RecruiterProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # One-to-many relationship with JobPosting
    job_postings: Mapped[list["JobPosting"]] = relationship(
        "JobPosting",
        back_populates="recruiter",
        cascade="all, delete-orphan",
    )

    # One-to-many relationship with Application (as student)
    applications: Mapped[list["Application"]] = relationship(
        "Application",
        back_populates="student",
        cascade="all, delete-orphan",
    )

    # One-to-one relationship with Resume (as student)
    resume: Mapped[Optional["Resume"]] = relationship(
        "Resume",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # One-to-one relationship with ProfileImage (as student)
    profile_image: Mapped[Optional["ProfileImage"]] = relationship(
        "ProfileImage",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # One-to-many relationship with SavedJob (as student)
    saved_jobs: Mapped[list["SavedJob"]] = relationship(
        "SavedJob",
        back_populates="student",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:



        return f'<User id={self.id} email={self.email} role={self.role}>'