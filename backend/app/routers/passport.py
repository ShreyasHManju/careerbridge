from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.passport import PassportResponse
from app.services.passport_service import PassportService

router = APIRouter(prefix="/passport", tags=["Experience Passport"])


@router.get(
    "/me",
    response_model=PassportResponse,
    summary="Get authenticated student's Experience Passport",
    description="Retrieves the comprehensive Experience Passport for the currently authenticated student.",
)
def get_my_passport(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve current student's Experience Passport with owner metadata.
    """
    return PassportService.get_student_passport(
        db=db,
        target_student_id=current_user.id,
        current_user=current_user,
    )


@router.get(
    "/{student_id}",
    response_model=PassportResponse,
    summary="Get public/recruiter Experience Passport for a student",
    description="Retrieves the evidence-backed Experience Passport for a student. Enforces strict verified-only and public-only server-side privacy boundaries.",
)
def get_student_passport(
    student_id: int = Path(..., ge=1, description="Unique user ID of the target student"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve candidate Experience Passport for recruiters, students, or administrators.
    """
    return PassportService.get_student_passport(
        db=db,
        target_student_id=student_id,
        current_user=current_user,
    )
