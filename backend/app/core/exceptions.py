from enum import Enum
from typing import Any, Dict, Optional


class ErrorCode(str, Enum):
    """
    Standard machine-readable error codes for the CareerBridge API.
    Used in all structured error responses.
    """
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
    INVALID_TOKEN = "INVALID_TOKEN"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    DUPLICATE_APPLICATION = "DUPLICATE_APPLICATION"
    RESOURCE_CONFLICT = "RESOURCE_CONFLICT"
    INVALID_STATE = "INVALID_STATE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    RESOURCE_OWNERSHIP_ERROR = "RESOURCE_OWNERSHIP_ERROR"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    BAD_REQUEST = "BAD_REQUEST"


class AppException(Exception):
    """
    Base domain exception for CareerBridge.
    All application-level exceptions inherit from this class.
    """
    def __init__(
        self,
        status_code: int = 400,
        message: str = "An error occurred",
        error_code: str = ErrorCode.BAD_REQUEST.value,
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        self.detail = detail if detail is not None else message
        self.headers = headers


class NotFoundException(AppException):
    """Resource was not found or is hidden."""
    def __init__(
        self,
        message: str = "Requested resource not found",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=404,
            message=message,
            error_code=ErrorCode.NOT_FOUND.value,
            detail=detail,
            headers=headers,
        )


class AuthenticationRequiredException(AppException):
    """Authentication credentials are missing or invalid."""
    def __init__(
        self,
        message: str = "Could not validate credentials",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        auth_headers = {"WWW-Authenticate": "Bearer"}
        if headers:
            auth_headers.update(headers)
        super().__init__(
            status_code=401,
            message=message,
            error_code=ErrorCode.AUTHENTICATION_REQUIRED.value,
            detail=detail,
            headers=auth_headers,
        )


class InvalidTokenException(AppException):
    """JWT token is cryptographically invalid or corrupted."""
    def __init__(
        self,
        message: str = "Invalid authentication token",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        auth_headers = {"WWW-Authenticate": "Bearer"}
        if headers:
            auth_headers.update(headers)
        super().__init__(
            status_code=401,
            message=message,
            error_code=ErrorCode.INVALID_TOKEN.value,
            detail=detail,
            headers=auth_headers,
        )


class TokenExpiredException(AppException):
    """JWT token has expired."""
    def __init__(
        self,
        message: str = "Authentication token has expired",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        auth_headers = {"WWW-Authenticate": "Bearer"}
        if headers:
            auth_headers.update(headers)
        super().__init__(
            status_code=401,
            message=message,
            error_code=ErrorCode.TOKEN_EXPIRED.value,
            detail=detail,
            headers=auth_headers,
        )


class ForbiddenException(AppException):
    """User does not have necessary permissions or role."""
    def __init__(
        self,
        message: str = "Not enough permissions",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=403,
            message=message,
            error_code=ErrorCode.FORBIDDEN.value,
            detail=detail,
            headers=headers,
        )


class ResourceOwnershipException(AppException):
    """Authenticated user does not own this private resource."""
    def __init__(
        self,
        message: str = "You do not have permission to access or modify this resource",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=403,
            message=message,
            error_code=ErrorCode.RESOURCE_OWNERSHIP_ERROR.value,
            detail=detail,
            headers=headers,
        )


class DuplicateResourceException(AppException):
    """A resource with the specified unique key already exists."""
    def __init__(
        self,
        message: str = "A resource with these details already exists",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=409,
            message=message,
            error_code=ErrorCode.RESOURCE_CONFLICT.value,
            detail=detail,
            headers=headers,
        )


class DuplicateApplicationException(AppException):
    """Candidate has already applied to this opportunity."""
    def __init__(
        self,
        message: str = "You have already applied for this internship.",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=409,
            message=message,
            error_code=ErrorCode.DUPLICATE_APPLICATION.value,
            detail=detail,
            headers=headers,
        )


class ConflictingInterviewException(AppException):
    """Interview time conflicts with another scheduled interview."""
    def __init__(
        self,
        message: str = "Conflicting interview scheduled at this time",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=409,
            message=message,
            error_code=ErrorCode.RESOURCE_CONFLICT.value,
            detail=detail,
            headers=headers,
        )


class InvalidStateException(AppException):
    """Operation cannot be performed in the current resource state."""
    def __init__(
        self,
        message: str = "Invalid resource state for this operation",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=400,
            message=message,
            error_code=ErrorCode.INVALID_STATE.value,
            detail=detail,
            headers=headers,
        )


class ValidationException(AppException):
    """Request validation failed."""
    def __init__(
        self,
        message: str = "Request validation failed",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=422,
            message=message,
            error_code=ErrorCode.VALIDATION_ERROR.value,
            detail=detail,
            headers=headers,
        )


class FileTooLargeException(AppException):
    """Uploaded file exceeds maximum configured size."""
    def __init__(
        self,
        message: str = "File size exceeds maximum allowed limit",
        status_code: int = 400,
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=status_code,
            message=message,
            error_code=ErrorCode.FILE_TOO_LARGE.value,
            detail=detail,
            headers=headers,
        )


class InvalidFileTypeException(AppException):
    """Uploaded file extension, content-type, or magic bytes signature is invalid."""
    def __init__(
        self,
        message: str = "Unsupported file type or invalid file signature",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=400,
            message=message,
            error_code=ErrorCode.INVALID_FILE_TYPE.value,
            detail=detail,
            headers=headers,
        )


class InternalServerException(AppException):
    """Unexpected internal server error."""
    def __init__(
        self,
        message: str = "An unexpected internal server error occurred.",
        detail: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(
            status_code=500,
            message=message,
            error_code=ErrorCode.INTERNAL_SERVER_ERROR.value,
            detail=detail,
            headers=headers,
        )
