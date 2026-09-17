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
