import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import rate_limiter
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])
security_logger = logging.getLogger("careerbridge.security")

# Pre-computed valid bcrypt hash used to equalize computation time when user does not exist (mitigating timing attacks)
DUMMY_BCRYPT_HASH = "$2b$12$qComxIALKdrrYAjJUW/.MuWGScSNVObvIZ0nNbIncZoAXPDTeCXdO"


def _mask_email(email: str) -> str:
    """Mask email for secure audit logging (e.g. j***n@example.com)."""
    try:
        parts = email.strip().split("@")
        if len(parts) != 2:
            return "***"
        local, domain = parts
        if len(local) <= 2:
            masked_local = local[0] + "*"
        else:
            masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
        return f"{masked_local}@{domain}"
    except Exception:
        return "***"


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user with email and password, returning a JWT access token.",
)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate user credentials:
    1. Check and enforce in-memory sliding window rate limits.
    2. Search database for user by email.
    3. Mitigate timing attacks by executing dummy bcrypt verification if user not found.
    4. Securely verify plaintext password against stored bcrypt hash.
    5. Verify account is active.
    6. Audit log authentication events and issue signed JWT access token.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"login:{client_ip}:{payload.email.strip().lower()}"

    if settings.RATE_LIMIT_LOGIN_ENABLED:
        rate_limiter.check_rate_limit(
            key=rate_key,
            max_attempts=settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS,
            window_seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
        )

    generic_auth_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user:
        # Mitigate timing attack: compute dummy bcrypt hash so response time is identical
        verify_password(payload.password, DUMMY_BCRYPT_HASH)
        if settings.RATE_LIMIT_LOGIN_ENABLED:
            rate_limiter.record_attempt(rate_key)
        security_logger.warning(
            "Authentication failed: Unknown email '%s' from IP %s",
            _mask_email(payload.email),
            client_ip,
        )
        raise generic_auth_exception

    if not verify_password(payload.password, user.password_hash):
        if settings.RATE_LIMIT_LOGIN_ENABLED:
            rate_limiter.record_attempt(rate_key)
        security_logger.warning(
            "Authentication failed: Invalid password for User ID %s ('%s') from IP %s",
            user.id,
            _mask_email(payload.email),
            client_ip,
        )
        raise generic_auth_exception

    if not user.is_active:
        if settings.RATE_LIMIT_LOGIN_ENABLED:
            rate_limiter.record_attempt(rate_key)
        security_logger.warning(
            "Authentication failed: Inactive account for User ID %s ('%s') from IP %s",
            user.id,
            _mask_email(payload.email),
            client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Authentication succeeded: reset failed attempts for this key
    if settings.RATE_LIMIT_LOGIN_ENABLED:
        rate_limiter.clear(rate_key)

    security_logger.info(
        "Authentication successful: User ID %s, Role '%s' from IP %s",
        user.id,
        user.role.value,
        client_ip,
    )

    access_token = create_access_token(subject=user.id)
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Retrieve account details of the currently authenticated user using the Bearer JWT token.",
)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Protected endpoint:
    Requires a valid JWT Bearer access token in the Authorization header.
    Returns safe user profile data (passwords and password hashes are strictly excluded).
    """
    return current_user
