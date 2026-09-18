from datetime import datetime, timezone
import logging
from typing import List, Optional
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus
from app.models.job_posting import JobPosting
from app.models.recruiter_profile import RecruiterProfile
from app.models.saved_job import SavedJob
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    AdminDashboardResponse,
    MonthlyRegistrationMetric,
    RecruiterDashboardResponse,
    StudentDashboardResponse,
)

logger = logging.getLogger("careerbridge.dashboard_service")


class DashboardService:
    """
    Service layer providing high-performance database-side aggregations for
    Student, Recruiter, and Administrator dashboards.
    Enforces strict role boundaries and data isolation using SQL aggregates.
    """

    @classmethod
    def get_student_dashboard(
        cls,
        db: Session,
        *,
        student_id: int,
    ) -> StudentDashboardResponse:
        """
        Aggregate dashboard metrics for the authenticated student.
        Strictly scoped to student_id.
        """
        # 1. Application status aggregates in a single database query
        app_stats = db.execute(
            select(
                func.count(Application.id).label("total_applications"),
                func.coalesce(
                    func.sum(
                        case(
                            (Application.status == ApplicationStatus.REVIEWING, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("applications_under_review"),
                func.coalesce(
                    func.sum(
                        case(
                            (Application.status == ApplicationStatus.SHORTLISTED, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("shortlisted_applications"),
                func.coalesce(
                    func.sum(
                        case(
                            (Application.status == ApplicationStatus.ACCEPTED, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("accepted_applications"),
            ).where(Application.student_id == student_id)
        ).one()

        # 2. Saved internships count
        saved_internships = db.scalar(
            select(func.count(SavedJob.id)).where(SavedJob.student_id == student_id)
        ) or 0

        # 3. Upcoming interviews: active statuses (SCHEDULED/RESCHEDULED) in the future
        now_utc = datetime.now(timezone.utc)
        upcoming_interviews = db.scalar(
            select(func.count(Interview.id)).where(
                Interview.student_id == student_id,
                Interview.status.in_([InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]),
                Interview.scheduled_at >= now_utc,
            )
        ) or 0

        return StudentDashboardResponse(
            total_applications=app_stats.total_applications or 0,
            applications_under_review=int(app_stats.applications_under_review or 0),
            shortlisted_applications=int(app_stats.shortlisted_applications or 0),
            accepted_applications=int(app_stats.accepted_applications or 0),
            saved_internships=saved_internships,
            upcoming_interviews=upcoming_interviews,
        )

    @classmethod
    def get_recruiter_dashboard(
        cls,
        db: Session,
        *,
        recruiter_id: int,
    ) -> RecruiterDashboardResponse:
        """
        Aggregate dashboard metrics for the authenticated recruiter.
        Strictly scoped to opportunities owned by recruiter_id.
        """
        # 1. Active/published postings owned by this recruiter
        active_internships = db.scalar(
            select(func.count(JobPosting.id)).where(
                JobPosting.recruiter_id == recruiter_id,
                JobPosting.is_active.is_(True),
            )
        ) or 0

        # 2. Application metrics for recruiter's postings
        rec_app_stats = db.execute(
            select(
                func.count(Application.id).label("total_applications"),
                func.coalesce(
                    func.sum(
                        case(
                            (Application.status == ApplicationStatus.APPLIED, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("applications_awaiting_review"),
                func.coalesce(
                    func.sum(
                        case(
                            (Application.status == ApplicationStatus.SHORTLISTED, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("shortlisted_candidates"),
            )
            .select_from(Application)
            .join(JobPosting, Application.job_posting_id == JobPosting.id)
            .where(JobPosting.recruiter_id == recruiter_id)
        ).one()

        # 3. Scheduled interviews associated with this recruiter's opportunities
        scheduled_interviews = db.scalar(
            select(func.count(Interview.id))
            .select_from(Interview)
            .join(Application, Interview.application_id == Application.id)
            .join(JobPosting, Application.job_posting_id == JobPosting.id)
            .where(
                JobPosting.recruiter_id == recruiter_id,
                Interview.status.in_([InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]),
            )
        ) or 0

        return RecruiterDashboardResponse(
            active_internships=active_internships,
            total_applications=rec_app_stats.total_applications or 0,
            applications_awaiting_review=int(rec_app_stats.applications_awaiting_review or 0),
            shortlisted_candidates=int(rec_app_stats.shortlisted_candidates or 0),
            scheduled_interviews=scheduled_interviews,
        )

    @classmethod
    def get_admin_dashboard(
        cls,
        db: Session,
        *,
        period_year: Optional[int] = None,
    ) -> AdminDashboardResponse:
        """
        Aggregate platform-wide administrative growth and performance metrics.
        Accessible only to platform administrators.
        """
        # 1. User role counts
        total_students = db.scalar(
            select(func.count(User.id)).where(User.role == UserRole.STUDENT)
        ) or 0

        total_companies = db.scalar(
            select(func.count(User.id)).where(User.role == UserRole.RECRUITER)
        ) or 0

        # 2. Verified organizations
        verified_companies = db.scalar(
            select(func.count(RecruiterProfile.id)).where(RecruiterProfile.is_verified.is_(True))
        ) or 0

        # 3. Active/published opportunities across platform
        published_internships = db.scalar(
            select(func.count(JobPosting.id)).where(JobPosting.is_active.is_(True))
        ) or 0

        # 4. Total applications & acceptance count
        admin_app_stats = db.execute(
            select(
                func.count(Application.id).label("total"),
                func.coalesce(
                    func.sum(
                        case(
                            (Application.status == ApplicationStatus.ACCEPTED, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("accepted"),
            )
        ).one()

        total_applications = admin_app_stats.total or 0
        accepted_applications = int(admin_app_stats.accepted or 0)

        # 5. Application success rate: accepted / total * 100 (safe zero division)
        if total_applications > 0:
            success_rate = round((accepted_applications / total_applications) * 100.0, 2)
        else:
            success_rate = 0.0

        # 6. Monthly registrations for the current calendar year
        target_year = period_year or datetime.now(timezone.utc).year
        year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
        month_label = func.to_char(User.created_at, "YYYY-MM")

        monthly_rows = db.execute(
            select(
                month_label.label("month"),
                func.count(User.id).label("count"),
            )
            .where(User.created_at >= year_start)
            .group_by(month_label)
            .order_by(month_label.asc())
        ).all()

        monthly_registrations = [
            MonthlyRegistrationMetric(month=row.month, count=row.count)
            for row in monthly_rows
        ]

        return AdminDashboardResponse(
            total_students=total_students,
            total_companies=total_companies,
            verified_companies=verified_companies,
            published_internships=published_internships,
            total_applications=total_applications,
            application_success_rate=success_rate,
            monthly_registrations=monthly_registrations,
        )
