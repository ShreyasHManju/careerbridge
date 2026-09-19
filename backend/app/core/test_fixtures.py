"""
CareerBridge Centralized Test Fixtures and Factories Module
Provides reusable, isolated, and leak-free test helpers for backend testing.
"""

from contextlib import contextmanager
from datetime import datetime, timezone
import time
from typing import Generator, List, Optional
import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.models.application import Application, ApplicationStatus
from app.models.conversation import Conversation, ConversationParticipant
from app.models.interview import Interview
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.message import Message
from app.models.notification import Notification
from app.models.profile_image import ProfileImage
from app.models.recruiter_profile import RecruiterProfile
from app.models.resume import Resume
from app.models.saved_job import SavedJob
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

DEFAULT_TEST_PASSWORD = "StrongTestPassword123!"


@contextmanager
def get_test_db() -> Generator[Session, None, None]:
    """
    Context manager providing an isolated database session with
    guaranteed cleanup and rollback on unhandled exceptions.
    """
    db = SessionLocal(expire_on_commit=False)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def generate_test_email(prefix: str = "test") -> str:
    """Generate a guaranteed unique test email with millisecond precision and random suffix."""
    unique_suffix = f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
    return f"{prefix}_{unique_suffix}@careerbridge.io"


def create_test_user(
    db: Session,
    role: UserRole = UserRole.STUDENT,
    email_prefix: str = "user",
    email: Optional[str] = None,
    password: str = DEFAULT_TEST_PASSWORD,
    is_active: bool = True,
    is_verified: bool = False,
    create_profile: bool = True,
) -> User:
    """
    Factory function to create a test user with hashed credentials and optional associated profile.
    """
    target_email = email or generate_test_email(email_prefix)
    user = User(
        email=target_email,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
        is_verified=is_verified,
    )
    db.add(user)
    db.flush()

    if create_profile:
        if role == UserRole.STUDENT:
            profile = StudentProfile(
                user_id=user.id,
                full_name=f"Test Student {user.id}",
                degree="Computer Science",
                skills="Python, FastAPI, SQLAlchemy",
            )
            db.add(profile)
        elif role == UserRole.RECRUITER:
            recruiter_profile = RecruiterProfile(
                user_id=user.id,
                company_name=f"Test Corp {user.id}",
                company_website="https://testcorp.example.com",
                company_description="An innovative tech enterprise.",
                industry="Software Engineering",
                contact_name=f"Recruiter {user.id}",
                phone="+1-555-0199",
                company_location="San Francisco, CA",
            )
            db.add(recruiter_profile)

    db.commit()
    db.refresh(user)
    return user


def get_auth_headers(user: User) -> dict:
    """
    Generate HTTP Authorization Bearer headers for a given User entity.
    """
    token = create_access_token(subject=user.id)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def create_test_job(
    db: Session,
    recruiter_id: int,
    title: str = "Software Engineering Intern",
    description: str = "Join our engineering team to build scalable microservices.",
    company_name: str = "Test Enterprise Corp",
    location: str = "San Francisco, CA",
    is_remote: bool = False,
    opportunity_type: OpportunityType = OpportunityType.INTERNSHIP,
    employment_type: EmploymentType = EmploymentType.FULL_TIME,
    salary_min: Optional[int] = 3500,
    salary_max: Optional[int] = 5000,
    is_active: bool = True,
) -> JobPosting:
    """
    Factory function to create a test JobPosting owned by a recruiter.
    """
    job = JobPosting(
        recruiter_id=recruiter_id,
        title=title,
        description=description,
        company_name=company_name,
        location=location,
        is_remote=is_remote,
        opportunity_type=opportunity_type,
        employment_type=employment_type,
        salary_min=salary_min,
        salary_max=salary_max,
        is_active=is_active,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def create_test_application(
    db: Session,
    student_id: int,
    job_posting_id: int,
    status: ApplicationStatus = ApplicationStatus.APPLIED,
    cover_message: str = "I am excited to apply for this position.",
) -> Application:
    """
    Factory function to create a test Application linked to a student and job posting.
    """
    app_record = Application(
        student_id=student_id,
        job_posting_id=job_posting_id,
        status=status,
        cover_message=cover_message,
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)
    return app_record


def clean_test_records(
    db: Session,
    user_ids: Optional[List[int]] = None,
    emails: Optional[List[str]] = None,
) -> None:
    """
    Clean up test entities and their cascading dependencies in safe topological order.
    """
    target_ids = set(user_ids or [])
    if emails:
        queried_users = db.scalars(select(User).where(User.email.in_(emails))).all()
        target_ids.update(u.id for u in queried_users)

    if not target_ids:
        return

    id_list = list(target_ids)

    # 1. Dependent applications
    db.execute(delete(Application).where(Application.student_id.in_(id_list)))

    # 2. Find jobs owned by any recruiters in target_ids
    owned_jobs = db.scalars(select(JobPosting.id).where(JobPosting.recruiter_id.in_(id_list))).all()
    if owned_jobs:
        job_apps = db.scalars(select(Application.id).where(Application.job_posting_id.in_(owned_jobs))).all()
        if job_apps:
            db.execute(delete(Interview).where(Interview.application_id.in_(job_apps)))
        db.execute(delete(Application).where(Application.job_posting_id.in_(owned_jobs)))
        db.execute(delete(SavedJob).where(SavedJob.job_posting_id.in_(owned_jobs)))
        db.execute(delete(JobPosting).where(JobPosting.id.in_(owned_jobs)))

    # 3. User-level bookmarks and interviews
    db.execute(delete(SavedJob).where(SavedJob.student_id.in_(id_list)))
    db.execute(delete(Interview).where(Interview.student_id.in_(id_list)))
    db.execute(delete(Interview).where(Interview.recruiter_id.in_(id_list)))

    # 4. User-level notifications
    db.execute(delete(Notification).where(Notification.user_id.in_(id_list)))

    # 5. Messaging tables
    db.execute(delete(Message).where(Message.sender_id.in_(id_list)))
    db.execute(delete(ConversationParticipant).where(ConversationParticipant.user_id.in_(id_list)))

    # 6. Uploaded files & profiles
    db.execute(delete(Resume).where(Resume.student_id.in_(id_list)))
    db.execute(delete(ProfileImage).where(ProfileImage.student_id.in_(id_list)))
    db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(id_list)))
    db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(id_list)))

    # 7. Finally, Users
    db.execute(delete(User).where(User.id.in_(id_list)))
    db.commit()
