from typing import List
from fastapi import APIRouter, Depends, Path, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.rate_limit import rate_limiter
from app.models.user import User, UserRole
from app.schemas.passport import (
    PassportResponse,
    PassportShareCreateRequest,
    PassportShareCreateResponse,
    PassportShareSummaryResponse,
    PassportShareUpdateRequest,
    PublicPassportResponse,
)
from app.services.passport_service import PassportService

router = APIRouter(prefix="/passport", tags=["Experience Passport"])
public_router = APIRouter(prefix="/public/passport", tags=["Public Career Passport"])


# ==============================================================================
# Authenticated Student Passport Share Management Endpoints
# ==============================================================================

@router.post(
    "/shares",
    response_model=PassportShareCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new public Passport share link",
    description=(
        "Generates a granular, secure public share link for the authenticated student's Career Passport. "
        "The raw 256-bit token is returned only in this response; only its SHA-256 hash is persisted."
    ),
)
def create_share_link(
    payload: PassportShareCreateRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Create a new Passport share link owned by the authenticated student.
    """
    return PassportService.create_share_link(
        db=db,
        student_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/shares",
    response_model=List[PassportShareSummaryResponse],
    summary="List student's Passport share links",
    description=(
        "Retrieves all active and historical Passport share links created by the authenticated student. "
        "Raw tokens are never returned; a masked token preview is provided."
    ),
)
def list_share_links(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    List all share links owned by the authenticated student.
    """
    return PassportService.list_share_links(
        db=db,
        student_id=current_user.id,
    )


@router.patch(
    "/shares/{share_id}",
    response_model=PassportShareSummaryResponse,
    summary="Update a Passport share link",
    description=(
        "Updates settings (label, contact permissions, unverified project visibility, expiration, activation) "
        "on an existing Passport share link owned by the authenticated student. Enforces strict student ownership."
    ),
)
def update_share_link(
    payload: PassportShareUpdateRequest,
    share_id: int = Path(..., ge=1, description="Unique identifier of the passport share link"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Update a Passport share link owned by the authenticated student.
    """
    return PassportService.update_share_link(
        db=db,
        share_id=share_id,
        student_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/shares/{share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a Passport share link",
    description=(
        "Deactivates and revokes an existing Passport share link owned by the authenticated student. "
        "Subsequent public requests using this link will receive HTTP 410 Gone."
    ),
)
def revoke_share_link(
    share_id: int = Path(..., ge=1, description="Unique identifier of the passport share link"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Revoke a Passport share link owned by the authenticated student.
    """
    PassportService.revoke_share_link(
        db=db,
        share_id=share_id,
        student_id=current_user.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==============================================================================
# Authenticated / Internal Passport Retrieval Endpoints
# ==============================================================================

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


# ==============================================================================
# Public Career Passport Portal Endpoint (Unauthenticated, Rate Limited)
# ==============================================================================

@public_router.get(
    "/{share_token}",
    response_model=PublicPassportResponse,
    summary="Get public verified Career Passport",
    description=(
        "Resolves a public Career Passport share token into an explicit, sanitized verification projection. "
        "Requires no authentication. Enforces sliding-window rate limits, checks revocation/expiration, and prevents caching."
    ),
)
def get_public_passport(
    request: Request,
    response: Response,
    share_token: str = Path(..., min_length=10, description="Public Career Passport share token"),
    db: Session = Depends(get_db),
):
    """
    Publicly resolve a Career Passport share token with atomic view counting, rate limiting, and cache suppression.
    """
    client_ip = request.client.host if request and request.client else "unknown"
    rate_key = f"public_passport:{client_ip}"
    rate_limiter.check_and_record_rate_limit(
        key=rate_key,
        max_attempts=60,
        window_seconds=60,
        message="Too many requests for public passport. Please slow down.",
    )

    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    return PassportService.get_public_passport(
        db=db,
        raw_token=share_token,
    )


@router.get(
    "/public/{share_token}",
    response_model=PublicPassportResponse,
    summary="Get public verified Career Passport (alias)",
    description="Convenience route alias for resolving public Career Passport share tokens.",
    include_in_schema=False,
)
def get_public_passport_alias(
    request: Request,
    response: Response,
    share_token: str = Path(..., min_length=10),
    db: Session = Depends(get_db),
):
    """Alias for /api/v1/public/passport/{share_token}."""
    return get_public_passport(request=request, response=response, share_token=share_token, db=db)
