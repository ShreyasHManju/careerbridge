from fastapi import FastAPI, HTTPException, status
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

app = FastAPI(
    title="CareerBridge API",
    version="0.1.0",
    description="Backend API for CareerBridge",
    docs_url="/docs",
    redoc_url="/redoc",
)

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

