from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Common declarative base for all CareerBridge SQLAlchemy models.
    Maintains the shared MetaData catalog and mapper registry.
    """
    pass
