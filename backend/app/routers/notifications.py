from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.notification_preference import NotificationFrequency, NotificationPreference
from app.models.user import User
from app.schemas.notification import (
    NotificationMarkAllReadResponse,
    NotificationPaginationResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    NotificationUnreadCountResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationPaginationResponse,
    status_code=status.HTTP_200_OK,
    summary="List notifications for the current user",
    description="Returns a paginated list of in-app notifications for the authenticated user, ordered newest first. Supports unread filtering.",
)
def list_notifications(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = NotificationService.list_notifications(
        db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        unread_only=unread_only,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return NotificationPaginationResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get unread notification count",
    description="Returns the total count of unread notifications for the authenticated user.",
)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = NotificationService.get_unread_count(db, user_id=current_user.id)
    return NotificationUnreadCountResponse(unread_count=count)


@router.patch(
    "/read-all",
    response_model=NotificationMarkAllReadResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
    description="Marks all unread notifications as read for the authenticated user in a single operation.",
)
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    marked_count = NotificationService.mark_all_as_read(db, user_id=current_user.id)
    return NotificationMarkAllReadResponse(marked_read_count=marked_count)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a specific notification as read",
    description="Marks a specific notification as read for the authenticated user. Rejects unowned notifications with 404.",
)
def mark_notification_as_read(
    notification_id: int = Path(..., ge=1, description="Primary key identifier of the notification to mark as read"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = NotificationService.mark_as_read(
        db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


# --------------------------------------------------------------------------
# Notification Preferences Endpoints (Phase 30B)
# --------------------------------------------------------------------------
@router.get(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user notification digest & delivery preferences",
    description="Retrieves the notification frequency (instant vs digest) and email settings for the authenticated user. Defaults to instant delivery if not yet configured.",
)
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = db.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    if not pref:
        # Return default instant delivery settings without mutating DB unnecessarily
        return NotificationPreferenceResponse(
            id=None,
            user_id=current_user.id,
            frequency="instant",
            email_notifications=True,
            created_at=None,
            updated_at=None,
        )

    return NotificationPreferenceResponse(
        id=pref.id,
        user_id=pref.user_id,
        frequency=pref.frequency.value if hasattr(pref.frequency, "value") else str(pref.frequency),
        email_notifications=pref.email_notifications,
        created_at=pref.created_at,
        updated_at=pref.updated_at,
    )


@router.patch(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user notification digest & delivery preferences",
    description="Updates the notification frequency ('instant' or 'digest') and email notification toggles for the authenticated user.",
)
def update_notification_preferences(
    payload: NotificationPreferenceUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = db.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )

    if not pref:
        freq = (
            NotificationFrequency(payload.frequency)
            if payload.frequency
            else NotificationFrequency.INSTANT
        )
        email_notif = (
            payload.email_notifications
            if payload.email_notifications is not None
            else True
        )
        pref = NotificationPreference(
            user_id=current_user.id,
            frequency=freq,
            email_notifications=email_notif,
        )
        db.add(pref)
    else:
        if payload.frequency is not None:
            pref.frequency = NotificationFrequency(payload.frequency)
        if payload.email_notifications is not None:
            pref.email_notifications = payload.email_notifications

    db.commit()
    db.refresh(pref)

    return NotificationPreferenceResponse(
        id=pref.id,
        user_id=pref.user_id,
        frequency=pref.frequency.value if hasattr(pref.frequency, "value") else str(pref.frequency),
        email_notifications=pref.email_notifications,
        created_at=pref.created_at,
        updated_at=pref.updated_at,
    )
