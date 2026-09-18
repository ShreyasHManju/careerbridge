from app.routers.admin import router as admin_router
from app.routers.applications import router as applications_router
from app.routers.auth import router as auth_router
from app.routers.job_posting import router as job_posting_router
from app.routers.rbac import router as rbac_router
from app.routers.notifications import router as notifications_router
from app.routers.profile_image import router as profile_image_router
from app.routers.recruiter_profile import router as recruiter_profile_router
from app.routers.resume import router as resume_router
from app.routers.saved_jobs import router as saved_jobs_router
from app.routers.student_profile import router as student_profile_router
from app.routers.users import router as users_router

__all__ = [
    "admin_router",
    "users_router",
    "auth_router",
    "rbac_router",
    "student_profile_router",
    "recruiter_profile_router",
    "job_posting_router",
    "applications_router",
    "resume_router",
    "profile_image_router",
    "saved_jobs_router",
    "notifications_router",
]





