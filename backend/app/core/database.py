import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

logger = logging.getLogger("careerbridge.database")

engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency providing a database session per request.
    Ensures connection is closed when request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """
    Pings the database to verify active connectivity.
    Returns True if database responds to 'SELECT 1', False on connection failure.
    Catches database connection errors to prevent unhandled 500 exceptions on health probes.
    """
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return result.scalar() == 1
    except SQLAlchemyError as exc:
        logger.warning("Database health check ping failed: %s", exc)
        return False
    except Exception as exc:
        logger.error("Unexpected error during database health check: %s", exc)
        return False
