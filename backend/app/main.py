from fastapi import FastAPI

app = FastAPI(
    title="Student Internship Management System API",
    version="0.1.0",
    description="Backend API for Student Internship Management System",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Student Internship Management System API",
        "status": "ok",
    }
