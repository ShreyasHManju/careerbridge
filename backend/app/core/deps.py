from typing import Optional, Set
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

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
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

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


class RoleChecker:
    """
    Reusable FastAPI dependency to enforce Role-Based Access Control (RBAC).

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role(UserRole.ADMIN))])
        def admin_route(): ...

        # Or inject current_user:
        @router.get("/student-only")
        def student_route(current_user: User = Depends(require_role(UserRole.STUDENT))): ...

        # Multiple allowed roles:
        @router.get("/shared")
        def shared_route(current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.RECRUITER))): ...
    """

    def __init__(self, *allowed_roles: UserRole):
        if not allowed_roles:
            raise ValueError("RoleChecker requires at least one UserRole.")
        self.allowed_roles: Set[UserRole] = set(allowed_roles)

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user


require_role = RoleChecker

