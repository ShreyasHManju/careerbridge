import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent.parent / 'backend'
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.application import Application
from app.models.interview import Interview
from app.models.student_profile import StudentProfile
from app.models.recruiter_profile import RecruiterProfile
from app.models.notification import Notification
from sqlalchemy import select, delete

def cleanup():
    with SessionLocal() as db:
        e2e_users = db.scalars(select(User).where(User.email.like('e2e_%') | User.email.like('student_%@careerbridge.io'))).all()
        user_ids = [u.id for u in e2e_users]
        if user_ids:
            e2e_jobs = db.scalars(select(JobPosting).where(JobPosting.recruiter_id.in_(user_ids) | JobPosting.title.like('E2E %') | JobPosting.title.like('AI Software Engineer %'))).all()
            job_ids = [j.id for j in e2e_jobs]
            apps = db.scalars(select(Application).where(Application.student_id.in_(user_ids) | Application.job_posting_id.in_(job_ids))).all()
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

if __name__ == '__main__':
    cleanup()
