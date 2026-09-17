from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

# Standard HTTP Bearer scheme for OpenAPI/Swagger documentation
security_bearer = HTTPBearer(
    auto_error=False,
    description="JWT Bearer token. Enter the token value returned from /api/v1/auth/login.",
)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency to authenticate request via JWT Bearer token and retrieve the current active user.

    Steps:
    1. Verify Authorization header contains Bearer scheme and token.
    2. Decode JWT and validate cryptographic signature and expiration.
    3. Extract user ID from 'sub' claim.
    4. Query PostgreSQL database for corresponding user record.
    5. Ensure user exists and account is active.
    6. Return User ORM instance.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise CREDENTIALS_EXCEPTION

    token = credentials.credentials
    if not token:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_access_token(token)
        sub: Optional[str] = payload.get("sub")
        if sub is None:
            raise CREDENTIALS_EXCEPTION
        user_id = int(sub)
    except (jwt.PyJWTError, ValueError, TypeError):
        raise CREDENTIALS_EXCEPTION

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise CREDENTIALS_EXCEPTION

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
