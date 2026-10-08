from datetime import datetime, timedelta, timezone
import hashlib
import logging
import secrets
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import rate_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    TokenResponse,
)
from app.schemas.google_auth import GoogleLoginRequest
from app.schemas.user import UserResponse
from app.services.email_service import EmailService

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
    2. Search database for user by email using case-insensitive normalized comparison.
    3. Mitigate timing attacks by executing dummy bcrypt verification if user not found.
    4. Securely verify plaintext password against stored bcrypt hash.
    5. Verify account is active.
    6. Audit log authentication events and issue signed JWT access token.
    """
    client_ip = request.client.host if request.client else "unknown"
    normalized_email = payload.email.strip().lower()
    rate_key = f"login:{client_ip}:{normalized_email}"

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

    user = db.scalar(
        select(User).where(
            func.lower(User.email) == normalized_email,
            User.auth_provider == "local",
        )
    )
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
    if not user.password_hash:
        if settings.RATE_LIMIT_LOGIN_ENABLED:
            rate_limiter.record_attempt(rate_key)
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
        user.role.value if hasattr(user.role, "value") else str(user.role),
        client_ip,
    )

    access_token = create_access_token(subject=user.id, pwd_hash=user.password_hash)
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


@router.post(
    "/google",
    response_model=TokenResponse,
    summary="Google login",
    description="Authenticate or create a CareerBridge account using a verified Google ID token.",
)
def google_login(
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate a user using a Google ID token.

    Google verifies the user's identity first.
    CareerBridge then creates/loads the corresponding local user
    and issues its own JWT access token.
    """
    try:
        google_data = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        security_logger.warning(
            "Google authentication failed: invalid ID token"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    google_subject = google_data.get("sub")
    email = google_data.get("email")
    email_verified = google_data.get("email_verified", False)

    if not google_subject or not email:
        security_logger.warning(
            "Google authentication failed: missing sub or email"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account information is incomplete.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not email_verified:
        security_logger.warning(
            "Google authentication failed: email not verified"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email address is not verified.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    normalized_email = email.strip().lower()

    # 1. Existing user with this Google subject
    user = db.scalar(
        select(User).where(User.google_subject == google_subject)
    )

    if user:
        if not user.is_active:
            security_logger.warning(
                "Google authentication failed: Inactive account for User ID %s",
                user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user account.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        security_logger.info(
            "Google authentication successful: User ID %s",
            user.id,
        )

        access_token = create_access_token(subject=user.id, pwd_hash=user.password_hash)
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
        )

    # 2. Check if a local account with the same email already exists
    existing_user_by_email = db.scalar(
        select(User).where(func.lower(User.email) == normalized_email)
    )

    if existing_user_by_email:
        security_logger.warning(
            "Google authentication conflict: account exists for email '%s' with auth_provider='%s'",
            _mask_email(normalized_email),
            existing_user_by_email.auth_provider,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in using your original method.",
        )

    # 3. Create a new Google-authenticated student user
    user = User(
        email=normalized_email,
        password_hash=None,
        auth_provider="google",
        google_subject=google_subject,
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    security_logger.info(
        "New Google account created: User ID %s",
        user.id,
    )

    access_token = create_access_token(subject=user.id, pwd_hash=user.password_hash)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.post(
    "/password-reset/request",
    response_model=PasswordResetResponse,
    summary="Request password reset link",
    description="Initiate a password reset flow. Dispatches a time-sensitive reset link if the account exists.",
)
def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Request a password reset link:
    1. Apply dual-key sliding-window rate limiting (per email and per client IP).
    2. Search user by email using case-insensitive normalized comparison without leaking existence.
    3. If user exists, is active, and is local, invalidate previous unused tokens, generate secure token, and dispatch email.
    4. Always return generic 200 response to prevent account enumeration.
    """
    client_ip = request.client.host if request.client else "unknown"
    normalized_email = payload.email.strip().lower()
    rate_key_email = f"pwd_reset:email:{client_ip}:{normalized_email}"
    rate_key_ip = f"pwd_reset:ip:{client_ip}"

    if settings.RATE_LIMIT_PASSWORD_RESET_ENABLED:
        rate_limiter.check_and_record_rate_limit(
            key=rate_key_email,
            max_attempts=settings.RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS,
            window_seconds=settings.RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS,
            message="Too many password reset attempts for this email. Please try again later.",
        )
        rate_limiter.check_and_record_rate_limit(
            key=rate_key_ip,
            max_attempts=settings.RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS * 5,
            window_seconds=settings.RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS,
            message="Too many password reset requests from this IP address. Please try again later.",
        )

    user = db.scalar(
        select(User).where(
            func.lower(User.email) == normalized_email,
            User.auth_provider == "local",
        )
    )

    if user and user.is_active and user.password_hash:
        now_utc = datetime.now(timezone.utc)

        # Invalidate previous unused reset tokens for this user
        db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=now_utc)
        )

        # Generate cryptographically secure random token (32 bytes urlsafe)
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now_utc + timedelta(minutes=15)

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=client_ip,
        )
        db.add(reset_record)
        db.commit()

        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        EmailService.dispatch_password_reset(
            to_email=user.email,
            reset_url=reset_url,
            user_name=user.email.split("@")[0],
            background_tasks=background_tasks,
        )
        security_logger.info(
            "Password reset dispatched for User ID %s from IP %s",
            user.id,
            client_ip,
        )
    else:
        security_logger.info(
            "Password reset requested for non-existent, inactive, or non-local email '%s' from IP %s",
            _mask_email(normalized_email),
            client_ip,
        )

    return PasswordResetResponse()


@router.post(
    "/password-reset/confirm",
    response_model=PasswordResetConfirmResponse,
    summary="Confirm password reset",
    description="Validate single-use password reset token and update user password.",
)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Confirm password reset:
    1. Validate password match and complexity.
    2. Compute SHA-256 hash of supplied token.
    3. Look up active, unused, unexpired reset token record.
    4. Hash new password with bcrypt and update user record.
    5. Mark reset token as used and invalidate any other tokens for that user.
    6. Advance user updated_at timestamp to invalidate previous JWT sessions.
    """
    client_ip = request.client.host if request.client else "unknown"

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match.",
        )

    token_str = payload.token.strip()
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    token_hash = hashlib.sha256(token_str.encode("utf-8")).hexdigest()

    token_record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash
        )
    )

    if not token_record:
        security_logger.warning(
            "Password reset confirmation failed: Unknown token hash from IP %s",
            client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    now_utc = datetime.now(timezone.utc)
    token_exp = (
        token_record.expires_at
        if token_record.expires_at.tzinfo
        else token_record.expires_at.replace(tzinfo=timezone.utc)
    )

    if token_record.used_at is not None or token_exp < now_utc:
        security_logger.warning(
            "Password reset confirmation failed: Token ID %s already used or expired from IP %s",
            token_record.id,
            client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    user = db.scalar(select(User).where(User.id == token_record.user_id))
    if not user or not user.is_active or user.auth_provider != "local":
        security_logger.warning(
            "Password reset confirmation failed: Ineligible or missing user for token ID %s",
            token_record.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    # Update password and advance updated_at timestamp for session invalidation
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = now_utc

    # Mark current token as used
    token_record.used_at = now_utc

    # Invalidate any other active reset tokens for this user
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now_utc)
    )

    db.commit()

    security_logger.info(
        "Password reset confirmed successfully for User ID %s from IP %s",
        user.id,
        client_ip,
    )

    return PasswordResetConfirmResponse()


@router.post(
    "/change-password",
    response_model=ChangePasswordResponse,
    summary="Change user password",
    description="Change password for the currently authenticated local account user.",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change user password:
    1. Verify current user is an active local account.
    2. Verify current password against stored bcrypt hash.
    3. Validate new password match and complexity.
    4. Hash new password with bcrypt and update user.
    5. Advance user updated_at timestamp to invalidate previous JWT sessions.
    """
    if current_user.auth_provider != "local" or not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is only supported for accounts with local credentials.",
        )

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match.",
        )

    now_utc = datetime.now(timezone.utc)
    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = now_utc

    db.commit()

    security_logger.info(
        "Password changed successfully for User ID %s",
        current_user.id,
    )

    return ChangePasswordResponse()
