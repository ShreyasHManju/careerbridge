from typing import List, Set
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.application import Application, ApplicationStatus
from app.models.job_posting import JobPosting
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.application import (
    ApplicationBulkStatusResponse,
    ApplicationBulkStatusUpdate,
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
)
from app.services.email_service import EmailService
from app.services.export_service import generate_csv_stream
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Applications"])


# --------------------------------------------------------------------------
# Student Application Submission
# --------------------------------------------------------------------------
@router.post(
    "/jobs/{job_id}/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an application to a job posting",
    description="Allows an authenticated student to apply to an active job or internship posting. Ownership is securely bound to current_user.id.",
)
def apply_to_job_posting(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting to apply to"),
    payload: ApplicationCreate = ...,
    background_tasks: BackgroundTasks = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Apply to a job posting:
    - Verifies job exists (404).
    - Verifies job is active (400).
    - Checks duplicate application (409).
    - Derives student_id strictly from current_user.id.
    - Sets initial status to 'applied'.
    """
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    if not job.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply to an inactive job posting",
        )

    # Check for duplicate submission
    existing = db.scalar(
        select(Application).where(
            Application.job_posting_id == job_id,
            Application.student_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied to this job posting",
        )

    new_app = Application(
        job_posting_id=job_id,
        student_id=current_user.id,
        status=ApplicationStatus.APPLIED,
        cover_message=payload.cover_message,
    )
    db.add(new_app)

    # In-app notification for the recruiter
    NotificationService.create_notification(
        db,
        user_id=job.recruiter_id,
        notification_type=NotificationType.APPLICATION_SUBMITTED,
        title="New Application Received",
        message=f"A student has applied to your posting '{job.title}'.",
    )

    db.commit()
    db.refresh(new_app)

    # Transactional email confirmation to the student
    EmailService.dispatch_application_confirmation_email(
        to_email=current_user.email,
        student_name=current_user.email.split("@")[0],
        job_title=job.title,
        company_name=job.company_name,
        application_id=new_app.id,
        background_tasks=background_tasks,
    )

    return new_app


# --------------------------------------------------------------------------
# Student Application Listing & Detail
# --------------------------------------------------------------------------
@router.get(
    "/applications/me",
    response_model=List[ApplicationResponse],
    summary="List all applications submitted by current student",
    description="Retrieves all applications submitted by the authenticated student, ordered newest first.",
)
def get_my_applications(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve current student's submitted applications.
    Strictly isolated to current_user.id.
    """
    apps = db.scalars(
        select(Application)
        .where(Application.student_id == current_user.id)
        .order_by(Application.created_at.desc())
    ).all()
    return apps


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationResponse,
    summary="Get single application details",
    description="Retrieve details of a single application. Accessible by the applicant student, the hiring recruiter, or admin.",
)
def get_application_by_id(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the application"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve single application.
    Enforces authorization:
    - Students may only view their own application (403).
    - Recruiters may only view applications to their own job postings (403).
    - Admins may view any application.
    """
    application = db.scalar(
        select(Application)
        .options(joinedload(Application.job_posting))
        .where(Application.id == application_id)
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.STUDENT:
        if application.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to view this application",
            )
    elif current_user.role == UserRole.RECRUITER:
        if application.job_posting.recruiter_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to view this application",
            )

    return application


# --------------------------------------------------------------------------
# Recruiter Application Review & Status Updates
# --------------------------------------------------------------------------
@router.get(
    "/recruiter/applications",
    response_model=List[ApplicationResponse],
    summary="List applications received for recruiter's job postings",
    description="Retrieves all candidate applications submitted across all job postings owned by the authenticated recruiter.",
)
def get_recruiter_applications(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    List all applications for postings owned by current recruiter.
    """
    apps = db.scalars(
        select(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(JobPosting.recruiter_id == current_user.id)
        .order_by(Application.created_at.desc())
    ).all()
    return apps


# --------------------------------------------------------------------------
# Applicant Data Export (Phase 30B)
# --------------------------------------------------------------------------
@router.get(
    "/recruiter/applications/export",
    summary="Export candidate applications as CSV (Recruiter only)",
    description="Streams a safe CSV file containing candidate applications for job postings owned by the authenticated recruiter. Protects against CSV formula injection.",
)
def export_recruiter_applications_csv(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Export recruiter candidate applications to CSV:
    - Restricted to recruiters (403 for students / non-recruiters).
    - Exports only applications to postings owned by current_user.
    - Sanitizes cell values against formula injection.
    """
    apps = db.scalars(
        select(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .options(joinedload(Application.job_posting))
        .where(JobPosting.recruiter_id == current_user.id)
        .order_by(Application.created_at.desc())
    ).all()

    fieldnames = [
        "application_id",
        "job_id",
        "job_title",
        "company_name",
        "student_id",
        "status",
        "cover_message",
        "created_at",
    ]

    rows = [
        {
            "application_id": app.id,
            "job_id": app.job_posting_id,
            "job_title": app.job_posting.title if app.job_posting else "",
            "company_name": app.job_posting.company_name if app.job_posting else "",
            "student_id": app.student_id,
            "status": app.status.value,
            "cover_message": app.cover_message or "",
            "created_at": app.created_at.isoformat() if app.created_at else "",
        }
        for app in apps
    ]

    csv_stream = generate_csv_stream(fieldnames, rows)

    return StreamingResponse(
        csv_stream,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="candidate_applications.csv"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@router.get(
    "/recruiter/applications/{application_id}",
    response_model=ApplicationResponse,
    summary="Get single application details (Recruiter view)",
    description="Retrieves single candidate application for a job posting owned by the authenticated recruiter.",
)
def get_recruiter_application_by_id(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the candidate application"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Recruiter detail view:
    Rejects cross-recruiter access with 403 Forbidden.
    """
    application = db.scalar(
        select(Application)
        .options(joinedload(Application.job_posting))
        .where(Application.id == application_id)
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if application.job_posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view this application",
        )

    return application


@router.patch(
    "/recruiter/applications/{application_id}",
    response_model=ApplicationResponse,
    summary="Update application status (Recruiter only)",
    description="Allows the hiring recruiter to transition application status (applied, reviewing, shortlisted, rejected, accepted).",
)
def update_application_status(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the candidate application"),
    payload: ApplicationUpdate = ...,
    background_tasks: BackgroundTasks = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Update application status:
    - Rejects cross-recruiter mutations (403).
    - Prevents modification of student_id or job_posting_id.
    """
    application = db.scalar(
        select(Application)
        .options(
            joinedload(Application.job_posting),
            joinedload(Application.student),
        )
        .where(Application.id == application_id)
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if application.job_posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this application",
        )

    old_status = application.status
    application.status = payload.status

    # In-app notification for the applicant student
    NotificationService.create_notification(
        db,
        user_id=application.student_id,
        notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
        title="Application Status Updated",
        message=f"Your application for '{application.job_posting.title}' has been updated to {payload.status.value}.",
    )

    db.commit()
    db.refresh(application)

    # Dispatch transactional status update email only when status has actually transitioned
    if old_status != payload.status:
        student_email = application.student.email if application.student else None
        if student_email:
            EmailService.dispatch_application_status_update_email(
                to_email=student_email,
                student_name=student_email.split("@")[0],
                job_title=application.job_posting.title,
                company_name=application.job_posting.company_name,
                new_status=payload.status.value,
                application_id=application.id,
                background_tasks=background_tasks,
            )

    return application


# --------------------------------------------------------------------------
# Batch Applicant Operations (Phase 30B)
# --------------------------------------------------------------------------
@router.post(
    "/applications/bulk-status",
    response_model=ApplicationBulkStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch update application statuses (Recruiter only)",
    description="Updates lifecycle status for a batch of candidate applications atomically. Enforces server-side ownership checks across every application in the payload.",
)
@router.post(
    "/recruiter/applications/bulk-status",
    response_model=ApplicationBulkStatusResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def bulk_update_application_status(
    payload: ApplicationBulkStatusUpdate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Bulk update candidate applications:
    - Empty list rejected by schema (422).
    - Checks ownership of EVERY application against current recruiter's job postings (403 if unowned).
    - Checks that all requested application IDs exist (404 if missing).
    - Atomically updates status for all applications.
    - Sends in-app notifications for each affected student.
    - Reversible transactional execution.
    """
    unique_ids: Set[int] = set(payload.application_ids)
    if not unique_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Application IDs list cannot be empty",
        )

    # Query all requested applications with their associated job posting
    apps = db.scalars(
        select(Application)
        .options(
            joinedload(Application.job_posting),
            joinedload(Application.student),
        )
        .where(Application.id.in_(unique_ids))
    ).all()

    found_map = {app.id: app for app in apps}

    # Verify that all requested IDs were found
    missing_ids = [app_id for app_id in unique_ids if app_id not in found_map]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Applications not found: {missing_ids}",
        )

    # Server-side authorization check: EVERY application must belong to the recruiter
    for app in apps:
        if not app.job_posting or app.job_posting.recruiter_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to update one or more specified applications",
            )

    # Perform atomic updates and trigger in-app notifications
    for app in apps:
        old_status = app.status
        app.status = payload.status

        NotificationService.create_notification(
            db,
            user_id=app.student_id,
            notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
            title="Application Status Updated",
            message=f"Your application for '{app.job_posting.title}' has been updated to {payload.status.value}.",
        )

    db.commit()

    # Refresh instances for response serialization
    for app in apps:
        db.refresh(app)

    return ApplicationBulkStatusResponse(
        updated_count=len(apps),
        status=payload.status,
        items=apps,
    )
