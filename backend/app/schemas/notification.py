from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    """
    Response schema for a user in-app notification.
    """
    id: int = Field(..., description="Unique notification ID")
    user_id: int = Field(..., description="ID of the recipient user")
    notification_type: NotificationType = Field(..., description="Notification category/type")
    title: str = Field(..., description="Short summary or notification title")
    message: str = Field(..., description="Notification message content")
    is_read: bool = Field(..., description="Whether notification has been read")
    created_at: datetime = Field(..., description="Timestamp when notification was generated")
    read_at: Optional[datetime] = Field(None, description="Timestamp when notification was marked as read")

    model_config = ConfigDict(from_attributes=True)


class NotificationPaginationResponse(BaseModel):
    """
    Paginated list of notifications for the authenticated user.
    """
    items: List[NotificationResponse] = Field(..., description="List of notification items")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Page size limit")
    total: int = Field(..., description="Total count of notifications matching query")
    total_pages: int = Field(..., description="Total pages available")

    model_config = ConfigDict(from_attributes=True)


class NotificationUnreadCountResponse(BaseModel):
    """
    Response schema for unread notification count.
    """
    unread_count: int = Field(..., description="Number of unread notifications for current user")


class NotificationMarkAllReadResponse(BaseModel):
    """
    Response schema for marking all notifications as read.
    """
    marked_read_count: int = Field(..., description="Number of notifications updated to read")
