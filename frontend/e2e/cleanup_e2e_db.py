import os
import sys
from pathlib import Path
from sqlalchemy import text, select, delete

backend_dir = Path(__file__).resolve().parent.parent.parent / 'backend'
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core import test_database
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.application import Application
from app.models.interview import Interview
from app.models.student_profile import StudentProfile
from app.models.recruiter_profile import RecruiterProfile
from app.models.notification import Notification

REQUIRED_REVISION = "b8c9d0e1f2a3"
EXPECTED_DATABASE = "internship_test_db"
EXPECTED_ROLE = "careerbridge_test_runner"


def verify_safe_cleanup_target(engine=None):
    """
    Fail closed unless connected to an approved, non-superuser test database
    at the expected Alembic schema revision.
    """
    test_db_url = os.environ.get("TEST_DATABASE_URL")
    if not test_db_url and engine is None:
        raise RuntimeError("TEST_DATABASE_URL must be explicitly set before running E2E database cleanup.")

    if engine is None:
        test_database.validate_test_database_url(test_db_url)
        engine = test_database.get_test_engine()

    identity = test_database.verify_test_database_identity(engine)
    if identity.get("database") != EXPECTED_DATABASE:
        raise RuntimeError(f"Cleanup aborted: Connected to unexpected database '{identity.get('database')}'.")
    if identity.get("user") != EXPECTED_ROLE:
        raise RuntimeError(f"Cleanup aborted: Connected with unauthorized role '{identity.get('user')}'.")
    if identity.get("is_superuser") is not False:
        raise RuntimeError("Cleanup aborted: Superuser access detected on cleanup connection.")

    with engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        if rev != REQUIRED_REVISION:
            raise RuntimeError(
                f"Cleanup aborted: Unexpected schema revision '{rev}'. Expected '{REQUIRED_REVISION}'."
            )
    return engine


def cleanup():
    engine = verify_safe_cleanup_target()
    session_factory = test_database.get_test_sessionmaker()
    with session_factory() as db:
        e2e_users = db.scalars(
            select(User).where(User.email.like('e2e_%') | User.email.like('student_%@careerbridge.io'))
        ).all()
        user_ids = [u.id for u in e2e_users]
        if user_ids:
            e2e_jobs = db.scalars(
                select(JobPosting).where(
                    JobPosting.recruiter_id.in_(user_ids)
                    | JobPosting.title.like('E2E %')
                    | JobPosting.title.like('AI Software Engineer %')
                )
            ).all()
            job_ids = [j.id for j in e2e_jobs]
            apps = db.scalars(
                select(Application).where(Application.student_id.in_(user_ids) | Application.job_posting_id.in_(job_ids))
            ).all()
            app_ids = [a.id for a in apps]
            if app_ids:
                db.execute(delete(Interview).where(Interview.application_id.in_(app_ids)))
                db.execute(delete(Application).where(Application.id.in_(app_ids)))
            if job_ids:
                db.execute(delete(JobPosting).where(JobPosting.id.in_(job_ids)))
            db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()
            print(f"Successfully cleaned up {len(user_ids)} E2E users and {len(job_ids)} jobs.")
        else:
            print("No transient E2E records found to clean up.")


if __name__ == '__main__':
    cleanup()
