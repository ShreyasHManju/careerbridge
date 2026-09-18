import inspect
import logging
from typing import Any, Callable, Dict, Optional
from fastapi import BackgroundTasks

logger = logging.getLogger("careerbridge.background_jobs")

JobHandler = Callable[..., Any]

_registry: Dict[str, JobHandler] = {}
_execution_history: list[dict] = []


def register_job(name: str, handler: JobHandler) -> None:
    """
    Register a callable handler function under a unique job name.
    """
    _registry[name] = handler
    logger.info(f"Registered background job: {name}")


def get_job(name: str) -> Optional[JobHandler]:
    """
    Look up a registered background job handler by name.
    """
    return _registry.get(name)


def clear_jobs() -> None:
    """
    Clear registry and history (used in testing).
    """
    _registry.clear()
    _execution_history.clear()


def get_execution_history() -> list[dict]:
    """
    Return recent background job executions for testing/inspection.
    """
    return list(_execution_history)


def _execute_job_safe(job_name: str, handler: JobHandler, *args, **kwargs) -> Any:
    """
    Safely execute a background job handler with error logging and history tracking.
    """
    try:
        if inspect.iscoroutinefunction(handler):
            import asyncio
            result = asyncio.run(handler(*args, **kwargs))
        else:
            result = handler(*args, **kwargs)

        _execution_history.append({
            "job_name": job_name,
            "status": "success",
            "args": args,
            "kwargs": kwargs,
        })
        logger.info(f"Background job '{job_name}' completed successfully.")
        return result
    except Exception as exc:
        _execution_history.append({
            "job_name": job_name,
            "status": "failed",
            "error": str(exc),
            "args": args,
            "kwargs": kwargs,
        })
        logger.error(f"Background job '{job_name}' failed with error: {exc}", exc_info=True)
        return None


def dispatch_job(
    job_name: str,
    *args,
    background_tasks: Optional[BackgroundTasks] = None,
    **kwargs,
) -> bool:
    """
    Dispatch a registered job.
    If background_tasks is provided, schedules job using FastAPI's BackgroundTasks.
    Otherwise, executes synchronously in-memory with safe error isolation.
    Returns True if the job was found and dispatched/executed, False otherwise.
    """
    handler = get_job(job_name)
    if not handler:
        logger.warning(f"Background job '{job_name}' is not registered.")
        return False

    if background_tasks is not None:
        background_tasks.add_task(_execute_job_safe, job_name, handler, *args, **kwargs)
    else:
        _execute_job_safe(job_name, handler, *args, **kwargs)

    return True
