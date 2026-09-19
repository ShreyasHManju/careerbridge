import logging
from typing import Any, Dict
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppException, ErrorCode

logger = logging.getLogger("careerbridge.error_handlers")


def _derive_error_code(status_code: int, message: str) -> str:
    """
    Intelligently maps an HTTP status code and message string into a standardized,
    machine-readable CareerBridge error code.
    """
    msg_lower = message.lower()

    if status_code == 400:
        if "size" in msg_lower or "exceed" in msg_lower or "large" in msg_lower:
            return ErrorCode.FILE_TOO_LARGE.value
        if (
            "extension" in msg_lower
            or "type" in msg_lower
            or "signature" in msg_lower
            or "magic" in msg_lower
            or "mime" in msg_lower
            or "format" in msg_lower
        ):
            return ErrorCode.INVALID_FILE_TYPE.value
        if "state" in msg_lower or "cannot" in msg_lower or "inactive" in msg_lower or "status" in msg_lower:
            return ErrorCode.INVALID_STATE.value
        if "already" in msg_lower or "duplicate" in msg_lower:
            return ErrorCode.RESOURCE_CONFLICT.value
        return ErrorCode.BAD_REQUEST.value

    elif status_code == 401:
        if "expired" in msg_lower:
            return ErrorCode.TOKEN_EXPIRED.value
        if "invalid" in msg_lower or "malformed" in msg_lower or "token" in msg_lower:
            return ErrorCode.INVALID_TOKEN.value
        return ErrorCode.AUTHENTICATION_REQUIRED.value

    elif status_code == 403:
        if "own" in msg_lower or "ownership" in msg_lower or "authorized" in msg_lower or "permission to access" in msg_lower:
            return ErrorCode.RESOURCE_OWNERSHIP_ERROR.value
        return ErrorCode.FORBIDDEN.value

    elif status_code == 404:
        return ErrorCode.NOT_FOUND.value

    elif status_code == 409:
        if "applied" in msg_lower:
            return ErrorCode.DUPLICATE_APPLICATION.value
        return ErrorCode.RESOURCE_CONFLICT.value

    elif status_code in (413,):
        return ErrorCode.FILE_TOO_LARGE.value

    elif status_code in (415,):
        return ErrorCode.INVALID_FILE_TYPE.value

    elif status_code == 422:
        return ErrorCode.VALIDATION_ERROR.value

    elif status_code == 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED.value

    elif status_code >= 500:
        return ErrorCode.INTERNAL_SERVER_ERROR.value

    return ErrorCode.BAD_REQUEST.value


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    Handler for all custom domain AppException instances.
    """
    payload = {
        "success": False,
        "message": exc.message,
        "error_code": exc.error_code,
        "detail": exc.detail,
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(payload),
        headers=exc.headers,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handler for standard Starlette/FastAPI HTTPExceptions.
    Ensures that every HTTP error returns a consistent JSON envelope with
    machine-readable error_code and backward-compatible detail.
    """
    message = str(exc.detail) if isinstance(exc.detail, str) else "Request error"
    error_code = _derive_error_code(exc.status_code, message)

    payload: Dict[str, Any] = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "detail": exc.detail,
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(payload),
        headers=exc.headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handler for Pydantic and FastAPI input validation errors (HTTP 422).
    """
    payload = {
        "success": False,
        "message": "Request validation failed.",
        "error_code": ErrorCode.VALIDATION_ERROR.value,
        "detail": jsonable_encoder(exc.errors()),
    }
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder(payload),
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """
    Handler for database integrity constraint violations escaping route handlers.
    Shields database internals, table names, and SQL statements.
    """
    err_str = str(exc.orig).lower() if hasattr(exc, "orig") and exc.orig else str(exc).lower()

    if "unique" in err_str or "duplicate key" in err_str or "already exists" in err_str:
        status_code = status.HTTP_409_CONFLICT
        message = "A resource with these details already exists."
        error_code = ErrorCode.RESOURCE_CONFLICT.value
    elif "foreign key" in err_str or "violates foreign key" in err_str:
        status_code = status.HTTP_400_BAD_REQUEST
        message = "Referenced resource does not exist or cannot be linked."
        error_code = ErrorCode.RESOURCE_CONFLICT.value
    else:
        status_code = status.HTTP_409_CONFLICT
        message = "Database integrity constraint violation."
        error_code = ErrorCode.RESOURCE_CONFLICT.value

    logger.warning("IntegrityError intercepted: %s (translated to %s)", exc, error_code)

    payload = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "detail": message,
    }
    return JSONResponse(
        status_code=status_code,
        content=payload,
    )


async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handler for unexpected database errors.
    Logs the full database error internally without exposing SQL queries or connection strings.
    """
    logger.exception("Database error occurred: %s", exc)
    payload = {
        "success": False,
        "message": "An internal database error occurred.",
        "error_code": ErrorCode.INTERNAL_SERVER_ERROR.value,
        "detail": "An internal database error occurred.",
    }
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=payload,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for unexpected server exceptions (HTTP 500).
    Logs the full traceback to the server console and logs, but returns a safe,
    sanitized error payload without leaking stack traces or internal paths.
    """
    logger.exception("Unhandled server exception: %s", exc)
    payload = {
        "success": False,
        "message": "An unexpected internal server error occurred.",
        "error_code": ErrorCode.INTERNAL_SERVER_ERROR.value,
        "detail": "An unexpected internal server error occurred.",
    }
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=payload,
    )


def register_error_handlers(app: FastAPI) -> None:
    """
    Register all centralized error handlers on the FastAPI application instance.
    """
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
