from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Schema for user authentication request."""
    email: EmailStr = Field(..., description="User account email address")
    password: str = Field(..., min_length=1, description="User plaintext password")


class TokenResponse(BaseModel):
    """Schema for successful authentication response containing JWT access token."""
    access_token: str = Field(..., description="JWT Bearer access token")
    token_type: str = Field(default="bearer", description="Token type (Bearer)")


class TokenPayload(BaseModel):
    """Schema for decoded JWT token payload."""
    sub: Optional[str] = None
    exp: Optional[int] = None


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""
    email: EmailStr = Field(..., description="User account email address for password reset")


class PasswordResetResponse(BaseModel):
    """Schema for uniform password reset confirmation response."""
    message: str = Field(
        default="If this email is registered, a password reset link has been sent.",
        description="Generic user-facing status message mitigating account enumeration",
    )
