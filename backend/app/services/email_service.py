import enum
import html
import logging
from pathlib import Path
import re
from string import Template
from typing import Any, Dict, Optional, Tuple

from fastapi import BackgroundTasks

from app.core.config import settings
from app.services.background_jobs import dispatch_job, get_job, register_job
from app.services.email_providers import (

    BaseEmailProvider,
    get_email_provider,
)

logger = logging.getLogger("careerbridge.email_service")

# Base directory for email templates
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

# Basic RFC-compliant email pattern regex check
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailEventType(str, enum.Enum):
    WELCOME = "welcome"
    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"
    APPLICATION_CONFIRMATION = "application_confirmation"
    APPLICATION_STATUS_UPDATE = "application_status_update"
    INTERVIEW_INVITATION = "interview_invitation"


class EmailService:
    """
    Core transactional email service.
    Renders templates safely, escapes user-controlled inputs, and delegates
    delivery to configured providers either synchronously or asynchronously via background jobs.
    """

    @staticmethod
    def is_valid_email(email: str) -> bool:
        """Validate email string format."""
        if not email or not isinstance(email, str):
            return False
        return bool(EMAIL_REGEX.match(email.strip()))

    @staticmethod
    def render_template(
        event_type: EmailEventType, context: Dict[str, Any]
    ) -> Tuple[str, str]:
        """
        Render plain text and HTML email templates for a given event type.
        Applies HTML escaping to all string values passed into the HTML template.
        """
        template_base_name = event_type.value
        txt_path = TEMPLATES_DIR / f"{template_base_name}.txt"
        html_path = TEMPLATES_DIR / f"{template_base_name}.html"

        if not txt_path.exists() or not html_path.exists():
            raise FileNotFoundError(
                f"Email templates for '{template_base_name}' not found at {TEMPLATES_DIR}"
            )

        # Standard context defaults
        base_context = {
            "frontend_url": settings.FRONTEND_URL,
            "portal_url": f"{settings.FRONTEND_URL}/dashboard",
            "dashboard_url": f"{settings.FRONTEND_URL}/dashboard",
        }
        merged_context = {**base_context, **context}

        # Raw string dictionary for plain text
        raw_dict = {k: str(v) if v is not None else "" for k, v in merged_context.items()}

        # HTML-escaped string dictionary for HTML template
        escaped_dict = {
            k: html.escape(str(v)) if v is not None else ""
            for k, v in merged_context.items()
        }

        with open(txt_path, "r", encoding="utf-8") as f:
            txt_content = f.read()
        with open(html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        rendered_txt = Template(txt_content).safe_substitute(raw_dict)
        rendered_html = Template(html_content).safe_substitute(escaped_dict)

        return rendered_txt, rendered_html

    @classmethod
    def send_email(
        cls,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        event_type: Optional[str] = None,
        provider: Optional[BaseEmailProvider] = None,
    ) -> bool:
        """
        Send an email directly through the email provider.
        """
        clean_email = to_email.strip() if to_email else ""
        if not cls.is_valid_email(clean_email):
            raise ValueError(f"Invalid recipient email address: '{to_email}'")

        if not subject or not subject.strip():
            raise ValueError("Email subject cannot be empty.")

        if not text_body or not text_body.strip():
            raise ValueError("Email text body cannot be empty.")

        active_provider = provider or get_email_provider()
        return active_provider.send(
            to_email=clean_email,
            subject=subject.strip(),
            text_body=text_body,
            html_body=html_body,
            event_type=event_type,
        )

    @classmethod
    def send_template_email(
        cls,
        to_email: str,
        event_type: EmailEventType,
        context: Dict[str, Any],
        subject: str,
        provider: Optional[BaseEmailProvider] = None,
    ) -> bool:
        """
        Render and deliver a templated email notification.
        """
        text_body, html_body = cls.render_template(event_type, context)
        return cls.send_email(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            event_type=event_type.value,
            provider=provider,
        )

    # ----------------------------------------------------------------------
    # Event Handlers (Executed synchronously or via background jobs)
    # ----------------------------------------------------------------------

    @classmethod
    def handle_send_welcome_email(
        cls,
        to_email: str,
        role: str,
        user_name: Optional[str] = None,
    ) -> bool:
        name = user_name or to_email.split("@")[0]
        context = {
            "user_name": name,
            "user_email": to_email,
            "role": role.capitalize(),
            "portal_url": f"{settings.FRONTEND_URL}/dashboard",
        }
        return cls.send_template_email(
            to_email=to_email,
            event_type=EmailEventType.WELCOME,
            context=context,
            subject="Welcome to CareerBridge!",
        )

    @classmethod
    def handle_send_email_verification(
        cls,
        to_email: str,
        verification_url: str,
        user_name: Optional[str] = None,
    ) -> bool:
        name = user_name or to_email.split("@")[0]
        context = {
            "user_name": name,
            "verification_url": verification_url,
        }
        return cls.send_template_email(
            to_email=to_email,
            event_type=EmailEventType.EMAIL_VERIFICATION,
            context=context,
            subject="Verify your CareerBridge email address",
        )

    @classmethod
    def handle_send_password_reset(
        cls,
        to_email: str,
        reset_url: str,
        user_name: Optional[str] = None,
    ) -> bool:
        name = user_name or to_email.split("@")[0]
        context = {
            "user_name": name,
            "reset_url": reset_url,
        }
        return cls.send_template_email(
            to_email=to_email,
            event_type=EmailEventType.PASSWORD_RESET,
            context=context,
            subject="Reset your CareerBridge password",
        )

    @classmethod
    def handle_send_application_confirmation_email(
        cls,
        to_email: str,
        student_name: str,
        job_title: str,
        company_name: str,
        application_id: int,
    ) -> bool:
        context = {
            "student_name": student_name,
            "job_title": job_title,
            "company_name": company_name,
            "application_id": str(application_id),
            "dashboard_url": f"{settings.FRONTEND_URL}/dashboard/applications",
        }
        subject = f"Application Received: {job_title} at {company_name}"
        return cls.send_template_email(
            to_email=to_email,
            event_type=EmailEventType.APPLICATION_CONFIRMATION,
            context=context,
            subject=subject,
        )

    @classmethod
    def handle_send_application_status_update_email(
        cls,
        to_email: str,
        student_name: str,
        job_title: str,
        company_name: str,
        new_status: str,
        application_id: int,
    ) -> bool:
        context = {
            "student_name": student_name,
            "job_title": job_title,
            "company_name": company_name,
            "new_status": new_status.capitalize(),
            "application_id": str(application_id),
            "dashboard_url": f"{settings.FRONTEND_URL}/dashboard/applications",
        }
        subject = f"Application Update: {job_title} ({new_status.capitalize()})"
        return cls.send_template_email(
            to_email=to_email,
            event_type=EmailEventType.APPLICATION_STATUS_UPDATE,
            context=context,
            subject=subject,
        )

    @classmethod
    def handle_send_interview_invitation_email(
        cls,
        to_email: str,
        student_name: str,
        job_title: str,
        company_name: str,
        interview_type: str,
        scheduled_at: str,
        duration_minutes: int,
        location_or_link: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> bool:
        context = {
            "student_name": student_name,
            "job_title": job_title,
            "company_name": company_name,
            "interview_type": interview_type.capitalize(),
            "scheduled_at": scheduled_at,
            "duration_minutes": str(duration_minutes),
            "location_or_link": location_or_link or "Details will be provided by the recruiter",
            "notes": notes or "None",
            "dashboard_url": f"{settings.FRONTEND_URL}/dashboard/interviews",
        }
        subject = f"Interview Scheduled: {job_title} at {company_name}"
        return cls.send_template_email(
            to_email=to_email,
            event_type=EmailEventType.INTERVIEW_INVITATION,
            context=context,
            subject=subject,
        )

    # ----------------------------------------------------------------------
    # Dispatchers (Enqueue jobs via FastAPI BackgroundTasks or in-process)
    # ----------------------------------------------------------------------

    @classmethod
    def dispatch_welcome_email(
        cls,
        to_email: str,
        role: str,
        user_name: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> bool:
        if not get_job("send_welcome_email"):
            cls.register_background_jobs()
        return dispatch_job(
            "send_welcome_email",
            to_email=to_email,
            role=role,
            user_name=user_name,
            background_tasks=background_tasks,
        )

    @classmethod
    def dispatch_email_verification(
        cls,
        to_email: str,
        verification_url: str,
        user_name: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> bool:
        if not get_job("send_email_verification"):
            cls.register_background_jobs()
        return dispatch_job(
            "send_email_verification",
            to_email=to_email,
            verification_url=verification_url,
            user_name=user_name,
            background_tasks=background_tasks,
        )

    @classmethod
    def dispatch_password_reset(
        cls,
        to_email: str,
        reset_url: str,
        user_name: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> bool:
        if not get_job("send_password_reset"):
            cls.register_background_jobs()
        return dispatch_job(
            "send_password_reset",
            to_email=to_email,
            reset_url=reset_url,
            user_name=user_name,
            background_tasks=background_tasks,
        )

    @classmethod
    def dispatch_application_confirmation_email(
        cls,
        to_email: str,
        student_name: str,
        job_title: str,
        company_name: str,
        application_id: int,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> bool:
        if not get_job("send_application_confirmation_email"):
            cls.register_background_jobs()
        return dispatch_job(
            "send_application_confirmation_email",
            to_email=to_email,
            student_name=student_name,
            job_title=job_title,
            company_name=company_name,
            application_id=application_id,
            background_tasks=background_tasks,
        )

    @classmethod
    def dispatch_application_status_update_email(
        cls,
        to_email: str,
        student_name: str,
        job_title: str,
        company_name: str,
        new_status: str,
        application_id: int,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> bool:
        if not get_job("send_application_status_update_email"):
            cls.register_background_jobs()
        return dispatch_job(
            "send_application_status_update_email",
            to_email=to_email,
            student_name=student_name,
            job_title=job_title,
            company_name=company_name,
            new_status=new_status,
            application_id=application_id,
            background_tasks=background_tasks,
        )

    @classmethod
    def dispatch_interview_invitation_email(
        cls,
        to_email: str,
        student_name: str,
        job_title: str,
        company_name: str,
        interview_type: str,
        scheduled_at: str,
        duration_minutes: int,
        location_or_link: Optional[str] = None,
        notes: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> bool:
        if not get_job("send_interview_invitation_email"):
            cls.register_background_jobs()
        return dispatch_job(
            "send_interview_invitation_email",
            to_email=to_email,
            student_name=student_name,
            job_title=job_title,
            company_name=company_name,
            interview_type=interview_type,
            scheduled_at=scheduled_at,
            duration_minutes=duration_minutes,
            location_or_link=location_or_link,
            notes=notes,
            background_tasks=background_tasks,
        )


    # ----------------------------------------------------------------------
    # Registration with background_jobs module
    # ----------------------------------------------------------------------

    @classmethod
    def register_background_jobs(cls) -> None:
        """
        Registers all email background job handlers.
        Safe to call during application startup and in testing environments.
        """
        register_job("send_welcome_email", cls.handle_send_welcome_email)
        register_job("send_email_verification", cls.handle_send_email_verification)
        register_job("send_password_reset", cls.handle_send_password_reset)
        register_job(
            "send_application_confirmation_email",
            cls.handle_send_application_confirmation_email,
        )
        register_job(
            "send_application_status_update_email",
            cls.handle_send_application_status_update_email,
        )
        register_job(
            "send_interview_invitation_email",
            cls.handle_send_interview_invitation_email,
        )
        logger.info("Registered all email background jobs.")


# Automatically register background jobs upon module import
EmailService.register_background_jobs()
