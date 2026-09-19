from typing import Any, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class ErrorResponse(BaseModel):
    """
    Consistent JSON error response structure for all application-level errors.
    Provides machine-readable error_code, user-friendly message, and backward-compatible detail.
    """
    model_config = ConfigDict(extra="ignore")

    success: bool = Field(
        default=False,
        description="Indicates whether the request was successful (always False on errors)",
    )
    message: str = Field(
        ...,
        description="Safe, user-facing error message explaining why the request failed",
    )
    error_code: str = Field(
        ...,
        description="Stable, machine-readable application error code",
    )
    detail: Optional[Any] = Field(
        None,
        description="Detailed contextual information or error description",
    )


class ValidationErrorDetail(BaseModel):
    """
    Detailed error descriptor for a single invalid parameter or request field.
    """
    model_config = ConfigDict(extra="ignore")

    loc: List[Union[str, int]] = Field(
        ...,
        description="Path to the invalid field (e.g. ['body', 'email'])",
    )
    msg: str = Field(
        ...,
        description="Validation error message for this specific field",
    )
    type: str = Field(
        ...,
        description="Validation error type identifier",
    )


class ValidationErrorResponse(BaseModel):
    """
    Standard error structure returned when input validation fails (HTTP 422).
    """
    model_config = ConfigDict(extra="ignore")

    success: bool = Field(
        default=False,
        description="Always False for validation failures",
    )
    message: str = Field(
        default="Request validation failed.",
        description="Summary validation failure message",
    )
    error_code: str = Field(
        default="VALIDATION_ERROR",
        description="Machine-readable code for validation errors",
    )
    detail: List[Any] = Field(
        ...,
        description="List of specific field validation errors",
    )
