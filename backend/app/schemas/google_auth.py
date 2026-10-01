from pydantic import BaseModel, Field


class GoogleLoginRequest(BaseModel):
    """Request containing a Google OAuth ID token."""

    credential: str = Field(
        ...,
        min_length=1,
        description="Google OAuth 2.0 ID token returned by Google Sign-In",
    )