from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user with email and password, returning a JWT access token.",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user credentials:
    1. Search database for user by email.
    2. Securely verify plaintext password against stored bcrypt hash.
    3. Verify account is active.
    4. Issue and return signed JWT access token.
    """
    generic_auth_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user:
        raise generic_auth_exception

    if not verify_password(payload.password, user.password_hash):
        raise generic_auth_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
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
