import re
import uuid
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings
from app.core.database import check_db_connection
from app.core.error_handlers import register_error_handlers
from app.core.logging import reset_request_id, set_request_id, setup_logging
from app.routers import (
    admin_router,
    applications_router,
    auth_router,
    dashboards_router,
    experience_records_router,
    innovation_projects_router,
    interviews_router,
    job_posting_router,
    messaging_router,
    notifications_router,
    passport_router,
    profile_image_router,
    rbac_router,
    recruiter_profile_router,
    resume_router,
    saved_jobs_router,
    skills_router,
    student_profile_router,
    users_router,
    websocket_messaging_router,
)

# Initialize centralized structured logging
setup_logging()

SAFE_REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


class RequestIdMiddleware:
    """
    Pure ASGI middleware to manage request correlation IDs:
    - Extracts or generates a unique correlation ID for every HTTP request.
    - Validates incoming X-Request-ID to prevent log injection or header splitting.
    - Binds the correlation ID to the async ContextVar for structured logging.
    - Appends X-Request-ID header to all HTTP responses.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        req_id = None
        for name, value in scope.get("headers", []):
            if name.lower() == b"x-request-id":
                try:
                    decoded = value.decode("latin1").strip()
                    if SAFE_REQUEST_ID_REGEX.match(decoded):
                        req_id = decoded
                except Exception:
                    pass
                break

        if not req_id:
            req_id = str(uuid.uuid4())

        token = set_request_id(req_id)
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["request_id"] = req_id

        async def send_with_request_id(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                has_req_id = any(h[0].lower() == b"x-request-id" for h in headers)
                if not has_req_id:
                    headers.append((b"x-request-id", req_id.encode("latin1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            reset_request_id(token)


class SecurityHeadersMiddleware:
    """
    Pure ASGI middleware to inject defense-in-depth HTTP security headers on all HTTP responses:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"DENY"))
                headers.append((b"x-xss-protection", b"1; mode=block"))
                headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


TAGS_METADATA = [
    {
        "name": "Authentication",
        "description": "User authentication, JWT token issuance, and authenticated identity retrieval.",
    },
    {
        "name": "Users",
        "description": "User account registration and management operations.",
    },
    {
        "name": "Student Profile",
        "description": "Student candidate profiles, educational backgrounds, skills, and portfolio links.",
    },
    {
        "name": "Recruiter Profile",
        "description": "Recruiter company profiles, corporate contact information, and verification status.",
    },
    {
        "name": "Jobs & Internships",
        "description": "Job and internship postings, discovery search, filtering, and recruiter management.",
    },
    {
        "name": "Innovation Projects",
        "description": "Student real-world innovation projects, skills integration, and project discovery.",
    },
    {
        "name": "Applications",
        "description": "Internship and job application submissions, lifecycle status tracking, and recruiter review.",
    },
    {
        "name": "Saved Jobs",
        "description": "Student job bookmarking and saved opportunity management.",
    },
    {
        "name": "Interviews",
        "description": "Interview scheduling, updates, rescheduling, and cancellation workflows.",
    },
    {
        "name": "Notifications",
        "description": "In-app notifications, unread counters, and notification status updates.",
    },
    {
        "name": "Messaging",
        "description": "Direct one-to-one messaging conversations and message history.",
    },
    {
        "name": "Real-Time Messaging",
        "description": "Real-time WebSocket two-way messaging connection and live event broadcasts.",
    },
    {
        "name": "Resume & Documents",
        "description": "Student resume PDF/DOCX document uploads, metadata inspection, and downloads.",
    },
    {
        "name": "Profile Image",
        "description": "Student profile image avatar uploads, metadata inspection, and downloads.",
    },
    {
        "name": "Dashboards",
        "description": "Role-specific aggregate metrics and KPI analytics for students, recruiters, and admins.",
    },
    {
        "name": "Admin",
        "description": "Administrative moderation of user accounts, recruiter verifications, and job postings.",
    },
    {
        "name": "RBAC Demonstration",
        "description": "Role-based access control validation and role enforcement demonstration routes.",
    },
    {
        "name": "Health",
        "description": "Service health probes and uptime diagnostics.",
    },
]


app = FastAPI(
    title="CareerBridge API",
    version="1.0.0",
    description="""
# CareerBridge API

Backend API for the CareerBridge Student Internship Management System.

CareerBridge connects students, recruiters, and administrators through a
secure internship and job management platform.

## Main capabilities

- **Authentication** — registration, login, JWT authentication, and current-user information
- **Student Management** — student profiles, resumes, and profile images
- **Recruiter Management** — recruiter profiles and job/internship postings
- **Applications** — internship/job applications and application status tracking
- **Saved Jobs** — bookmark and manage saved opportunities
- **Interviews** — schedule, update, and cancel interviews
- **Notifications** — in-app notifications and unread tracking
- **Messaging** — one-to-one messaging and real-time WebSocket communication
- **Dashboards** — student, recruiter, and administrator metrics
- **Administration** — user, recruiter, and job-posting moderation
- **RBAC** — role-based access control for students, recruiters, and administrators

## Authentication

Protected endpoints use a JWT Bearer access token:

`Authorization: Bearer <access_token>`

## API conventions

- JSON request and response bodies are used where applicable.
- Validation errors return HTTP `422`.
- Authentication failures return HTTP `401`.
- Permission failures return HTTP `403`.
- Missing resources return HTTP `404`.
- Conflict conditions return HTTP `409`.
- Unexpected server errors return HTTP `500`.

Use the Swagger UI to explore and test the API interactively.
""",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=TAGS_METADATA,
)

# Register CORS, Request ID, and Security Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)

# Register centralized exception and error handlers
register_error_handlers(app)

# Register API v1 Routers
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(rbac_router, prefix=settings.API_V1_STR)
app.include_router(student_profile_router, prefix=settings.API_V1_STR)
app.include_router(recruiter_profile_router, prefix=settings.API_V1_STR)
app.include_router(job_posting_router, prefix=settings.API_V1_STR)
app.include_router(applications_router, prefix=settings.API_V1_STR)
app.include_router(interviews_router, prefix=settings.API_V1_STR)
app.include_router(messaging_router, prefix=settings.API_V1_STR)
app.include_router(websocket_messaging_router, prefix=settings.API_V1_STR)
app.include_router(resume_router, prefix=settings.API_V1_STR)
app.include_router(profile_image_router, prefix=settings.API_V1_STR)
app.include_router(saved_jobs_router, prefix=settings.API_V1_STR)
app.include_router(skills_router, prefix=settings.API_V1_STR)
app.include_router(innovation_projects_router, prefix=settings.API_V1_STR)
app.include_router(experience_records_router, prefix=settings.API_V1_STR)
app.include_router(passport_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(dashboards_router, prefix=settings.API_V1_STR)


@app.get(
    "/",
    tags=["Health"],
    summary="API root status",
    description="Root endpoint returning API service identity and health indicator.",
)
def root():
    return {
        "message": "CareerBridge API",
        "status": "ok",
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="System health check",
    description="Health check endpoint verifying application connectivity and database availability.",
)
def health_check():
    db_ok = check_db_connection()
    if not db_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed",
        )
    return {
        "status": "ok",
        "database": "connected",
        "service": "CareerBridge API",
    }


@app.get("/test-error-500", tags=["Diagnostic"], include_in_schema=False)
def trigger_test_error_500():
    """Diagnostic route strictly for automated testing of 500 error handling."""
    raise RuntimeError("Simulated unexpected internal server error")

