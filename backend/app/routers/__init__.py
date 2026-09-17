from app.routers.auth import router as auth_router
from app.routers.job_posting import router as job_posting_router
from app.routers.rbac import router as rbac_router
from app.routers.recruiter_profile import router as recruiter_profile_router
from app.routers.student_profile import router as student_profile_router
from app.routers.users import router as users_router

__all__ = [
    "users_router",
    "auth_router",
    "rbac_router",
    "student_profile_router",
    "recruiter_profile_router",
    "job_posting_router",
]




