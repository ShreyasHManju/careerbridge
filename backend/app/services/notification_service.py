from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType


class NotificationService:
    """
    Service layer for managing user in-app notifications.
    Centralizes creation, querying, read state mutations, and unread counts.
    """

    @staticmethod
    def create_notification(
        db: Session,
        *,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        commit: bool = False,
    ) -> Notification:
        """
        Create a new notification for a specific user.
        If commit=True, commits and refreshes immediately.
        If commit=False, adds to session allowing the caller to commit as part of an atomic transaction.
        """
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            is_read=False,
        )
        db.add(notification)
        if commit:
            db.commit()
            db.refresh(notification)
        return notification

    @staticmethod
    def list_notifications(
        db: Session,
        *,
        user_id: int,
        page: int = 1,
        page_size: int = 10,
        unread_only: bool = False,
    ) -> Tuple[List[Notification], int]:
        """
        Retrieve paginated notifications for a user, ordered newest-first.
        Supports optional filtering by unread status.
        """
        conditions = [Notification.user_id == user_id]
        if unread_only:
            conditions.append(Notification.is_read == False)  # noqa: E712

        # Count total matching
        count_stmt = (
            select(func.count())
            .select_from(Notification)
            .where(*conditions)
        )
        total = db.scalar(count_stmt) or 0

        # Query items with pagination
        stmt = (
            select(Notification)
            .where(*conditions)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(db.scalars(stmt).all())

        return items, total

    @staticmethod
    def mark_as_read(
        db: Session,
        *,
        notification_id: int,
        user_id: int,
    ) -> Optional[Notification]:
        """
        Mark a specific notification as read.
        Returns the updated Notification if found and owned by user_id,
        or None if not found or unauthorized.
        """
        notification = db.scalar(
            select(Notification).where(Notification.id == notification_id)
        )
        if not notification:
            return None

        if notification.user_id != user_id:
            return None

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(notification)

        return notification

    @staticmethod
    def mark_all_as_read(
        db: Session,
        *,
        user_id: int,
    ) -> int:
        """
        Mark all unread notifications as read for a given user in a single UPDATE query.
        Returns the number of rows updated.
        """
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(
                is_read=True,
                read_at=datetime.now(timezone.utc),
            )
        )
        result = db.execute(stmt)
        db.commit()
        return int(result.rowcount or 0)

    @staticmethod
    def get_unread_count(
        db: Session,
        *,
        user_id: int,
    ) -> int:
        """
        Count all unread notifications for a user using an optimized SQL COUNT query.
        """
        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        )
        return int(db.scalar(stmt) or 0)
