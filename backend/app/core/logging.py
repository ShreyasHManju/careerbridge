import contextvars
import logging
import sys
from typing import Optional

# Concurrency-safe context variable for HTTP request correlation ID
request_id_ctx_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)


def get_request_id() -> Optional[str]:
    """Retrieve the correlation ID of the currently executing request, or None."""
    return request_id_ctx_var.get()


def set_request_id(request_id: Optional[str]) -> contextvars.Token:
    """Set the correlation ID for the current async task / thread context."""
    return request_id_ctx_var.set(request_id)


def reset_request_id(token: contextvars.Token) -> None:
    """Reset the correlation ID context variable using the given token."""
    request_id_ctx_var.reset(token)


class RequestIdFilter(logging.Filter):
    """
    Logging filter that automatically injects the active request_id into every
    LogRecord. Defaults to '-' when logging outside of an active HTTP request context.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        req_id = get_request_id()
        record.request_id = req_id if req_id else "-"
        return True


_logging_initialized = False


def setup_logging(level: int = logging.INFO) -> None:
    """
    Initialize centralized structured logging across the application.
    Configures format: [%(asctime)s] [%(levelname)s] [%(name)s] [request_id=%(request_id)s] %(message)s
    """
    global _logging_initialized
    if _logging_initialized:
        return

    formatter = logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(name)s] [request_id=%(request_id)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    req_filter = RequestIdFilter()

    # Configure stdout handler for careerbridge loggers
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(req_filter)

    root_logger = logging.getLogger()
    if not root_logger.handlers:
        root_logger.addHandler(handler)
        root_logger.setLevel(level)

    # Ensure careerbridge loggers have the filter and formatting
    cb_logger = logging.getLogger("careerbridge")
    cb_logger.setLevel(level)
    if not cb_logger.handlers:
        cb_logger.addHandler(handler)
    cb_logger.propagate = False

    _logging_initialized = True
