from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings
from app.core.database import check_db_connection
from app.core.error_handlers import register_error_handlers
from app.routers import (
    admin_router,
    applications_router,
    auth_router,
    dashboards_router,
    interviews_router,
    job_posting_router,
    messaging_router,
    notifications_router,
    profile_image_router,
    rbac_router,
    recruiter_profile_router,
    resume_router,
    saved_jobs_router,
    student_profile_router,
    users_router,
    websocket_messaging_router,
)


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


app = FastAPI(
    title="CareerBridge API",
    version="0.1.0",
    description="Backend API for CareerBridge",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Register CORS and Security Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

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
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(dashboards_router, prefix=settings.API_V1_STR)





@app.get("/", tags=["Health"])
def root():
    return {
        "message": "CareerBridge API",
        "status": "ok",
    }


@app.get("/health", tags=["Health"])
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

