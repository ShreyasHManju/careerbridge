from fastapi import FastAPI, HTTPException, status
from app.core.database import check_db_connection

app = FastAPI(
    title="CareerBridge API",
    version="0.1.0",
    description="Backend API for CareerBridge",
    docs_url="/docs",
    redoc_url="/redoc",
)


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
