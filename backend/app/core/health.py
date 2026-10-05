import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, Optional, Tuple

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import engine
from app.core.storage import LocalStorageProvider, S3StorageProvider, get_storage_provider

logger = logging.getLogger("careerbridge.health")

_cached_alembic_head: Optional[str] = None


def get_alembic_head_revision() -> Optional[str]:
    """
    Resolve the expected head revision from Alembic script directory.
    Caches the result after first resolution.
    """
    global _cached_alembic_head
    if _cached_alembic_head is not None:
        return _cached_alembic_head

    try:
        backend_dir = Path(__file__).resolve().parent.parent.parent
        alembic_ini_path = backend_dir / "alembic.ini"
        alembic_dir_path = backend_dir / "alembic"

        if alembic_ini_path.is_file() and alembic_dir_path.is_dir():
            alembic_cfg = Config(str(alembic_ini_path))
            alembic_cfg.set_main_option("script_location", str(alembic_dir_path))
            script_dir = ScriptDirectory.from_config(alembic_cfg)
            _cached_alembic_head = script_dir.get_current_head()
            return _cached_alembic_head
    except Exception as exc:
        logger.warning("Could not resolve Alembic head from script directory: %s", exc)
    return None


def check_liveness() -> Dict[str, str]:
    """
    Lightweight liveness probe.
    Does not touch database, network, or filesystem storage.
    """
    return {"status": "alive"}


def check_database_readiness() -> Tuple[bool, Dict[str, Any]]:
    """
    Check database connectivity and response latency.
    """
    start_time = time.perf_counter()
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            if result.scalar() == 1:
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return True, {
                    "status": "healthy",
                    "latency_ms": latency_ms,
                }
            return False, {
                "status": "unavailable",
                "detail": "unexpected ping response",
            }
    except SQLAlchemyError as exc:
        logger.warning("Database readiness probe failed: %s", exc)
        return False, {
            "status": "unavailable",
            "detail": "database connection failed",
        }
    except Exception as exc:
        logger.error("Unexpected error during database readiness probe: %s", exc)
        return False, {
            "status": "unavailable",
            "detail": "database error",
        }


def check_migration_readiness() -> Tuple[bool, Dict[str, Any]]:
    """
    Verify that current database revision matches Alembic migration head.
    """
    head_rev = get_alembic_head_revision()
    if not head_rev:
        return False, {
            "status": "unknown",
            "detail": "unable to resolve application migration head revision",
        }

    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
            db_rev = result.scalar()

            if not db_rev:
                return False, {
                    "status": "unmigrated",
                    "current_revision": None,
                    "head_revision": head_rev,
                    "detail": "no migration revision recorded in database",
                }

            if db_rev != head_rev:
                return False, {
                    "status": "mismatch",
                    "current_revision": str(db_rev),
                    "head_revision": head_rev,
                    "detail": "database schema revision does not match code head revision",
                }

            return True, {
                "status": "aligned",
                "current_revision": str(db_rev),
                "head_revision": head_rev,
            }
    except SQLAlchemyError as exc:
        logger.warning("Migration readiness probe query failed: %s", exc)
        return False, {
            "status": "unavailable",
            "detail": "could not inspect database migration version",
        }
    except Exception as exc:
        logger.error("Unexpected error inspecting migration readiness: %s", exc)
        return False, {
            "status": "unavailable",
            "detail": "migration inspection error",
        }


def check_storage_readiness() -> Tuple[bool, Dict[str, Any]]:
    """
    Verify configured storage provider readiness without mutating user data.
    """
    try:
        provider = get_storage_provider()

        if isinstance(provider, LocalStorageProvider):
            base_dir = provider.base_dir
            if not base_dir.is_dir() or not os.access(base_dir, os.W_OK):
                return False, {
                    "status": "unavailable",
                    "provider": "local",
                    "detail": "local upload directory is not writable",
                }
            return True, {
                "status": "ready",
                "provider": "local",
            }

        elif isinstance(provider, S3StorageProvider):
            if not provider.bucket_name:
                return False, {
                    "status": "unconfigured",
                    "provider": "s3",
                    "detail": "storage bucket is not configured",
                }
            try:
                client = provider._get_client()
                client.head_bucket(Bucket=provider.bucket_name)
                return True, {
                    "status": "ready",
                    "provider": "s3",
                    "bucket": provider.bucket_name,
                    "region": provider.region,
                }
            except Exception as exc:
                logger.warning("S3 storage readiness probe failed: %s", exc.__class__.__name__)
                return False, {
                    "status": "unavailable",
                    "provider": "s3",
                    "detail": "storage bucket connectivity check failed",
                }

        return False, {
            "status": "unknown_provider",
            "detail": "unrecognized storage provider type",
        }
    except Exception as exc:
        logger.warning("Storage readiness probe failed: %s", exc)
        return False, {
            "status": "unavailable",
            "detail": "storage provider error",
        }


def check_system_readiness() -> Tuple[int, Dict[str, Any]]:
    """
    Perform complete dependency readiness check.
    Returns (http_status_code, response_payload).
    """
    db_ok, db_check = check_database_readiness()
    mig_ok, mig_check = check_migration_readiness()
    stor_ok, stor_check = check_storage_readiness()

    all_ready = db_ok and mig_ok and stor_ok
    overall_status = "ready" if all_ready else "not_ready"
    http_code = status.HTTP_200_OK if all_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": overall_status,
        "checks": {
            "database": db_check,
            "migrations": mig_check,
            "storage": stor_check,
        },
    }

    return http_code, payload
