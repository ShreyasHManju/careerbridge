from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    AdminDashboardResponse,
    RecruiterDashboardResponse,
    StudentDashboardResponse,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboards"])


@router.get(
    "/student",
    response_model=StudentDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated student aggregated dashboard metrics",
    description="Returns aggregated application, saved internship, and upcoming interview counts strictly scoped to the authenticated student.",
)
def get_student_dashboard(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
) -> StudentDashboardResponse:
    """
    Retrieve real-time database-aggregated metrics for the authenticated student.
    Enforces strict role validation and data isolation.
    """
    return DashboardService.get_student_dashboard(db, student_id=current_user.id)


@router.get(
    "/recruiter",
    response_model=RecruiterDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated recruiter aggregated dashboard metrics",
    description="Returns aggregated active internship, application, pipeline review, and scheduled interview counts strictly scoped to opportunities owned by this recruiter.",
)
def get_recruiter_dashboard(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
) -> RecruiterDashboardResponse:
    """
    Retrieve real-time database-aggregated metrics for the authenticated recruiter.
    Enforces strict role validation and data isolation.
    """
    return DashboardService.get_recruiter_dashboard(db, recruiter_id=current_user.id)


@router.get(
    "/admin",
    response_model=AdminDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get platform-wide administrative dashboard metrics",
    description="Returns platform-wide growth indicators, total user counts, active opportunities, application success rate, and monthly registration volume.",
)
def get_admin_dashboard(
    period_year: Optional[int] = Query(
        None,
        ge=2000,
        le=2100,
        description="Calendar year for monthly registrations (defaults to current year)",
    ),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminDashboardResponse:
    """
    Retrieve real-time platform-wide analytics and growth indicators.
    Accessible strictly to platform administrators.
    """
    return DashboardService.get_admin_dashboard(db, period_year=period_year)
