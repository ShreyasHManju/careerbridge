from fastapi import APIRouter, Depends
from app.core.deps import require_role
from app.models.user import User, UserRole

router = APIRouter(prefix="/rbac", tags=["RBAC Demonstration"])


@router.get(
    "/student",
    summary="Student-only endpoint",
    description="Accessible strictly to users with the 'student' role.",
)
def student_only_route(current_user: User = Depends(require_role(UserRole.STUDENT))):
    return {
        "message": "Student access granted",
        "role": current_user.role.value,
    }


@router.get(
    "/recruiter",
    summary="Recruiter-only endpoint",
    description="Accessible strictly to users with the 'recruiter' role.",
)
def recruiter_only_route(current_user: User = Depends(require_role(UserRole.RECRUITER))):
    return {
        "message": "Recruiter access granted",
        "role": current_user.role.value,
    }


@router.get(
    "/admin",
    summary="Admin-only endpoint",
    description="Accessible strictly to users with the 'admin' role.",
)
def admin_only_route(current_user: User = Depends(require_role(UserRole.ADMIN))):
    return {
        "message": "Admin access granted",
        "role": current_user.role.value,
    }


@router.get(
    "/student-or-recruiter",
    summary="Multi-role endpoint (Student or Recruiter)",
    description="Accessible to users with either 'student' or 'recruiter' roles. Rejected for 'admin'.",
)
def student_or_recruiter_route(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.RECRUITER))
):
    return {
        "message": "Student or recruiter access granted",
        "role": current_user.role.value,
    }
