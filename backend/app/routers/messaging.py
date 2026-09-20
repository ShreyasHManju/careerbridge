from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.messaging import (
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    MarkReadResponse,
    MessageCreate,
    MessageListResponse,
    MessageResponse,
)
from app.services.messaging_service import MessagingService
from app.services.websocket_manager import ws_manager

router = APIRouter(tags=["Messaging"])


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start or retrieve a one-to-one conversation",
)
def create_or_get_conversation(
    payload: ConversationCreate,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start a private conversation with another user or retrieve existing one.
    Validates participant existence, active status, and prevents self-messaging.
    Returns 201 if created, or 200 if an existing conversation was reused.
    """
    conv, created, _ = MessagingService.get_or_create_conversation(
        db,
        current_user=current_user,
        other_user_id=payload.other_user_id,
        initial_message=payload.initial_message,
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return conv


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List current user's conversations",
)
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all conversations where the authenticated user is a participant,
    ordered by recent activity with unread counts and latest message preview.
    """
    items = MessagingService.list_conversations(db, current_user=current_user)
    return ConversationListResponse(items=items, total=len(items))


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get single conversation details",
)
def get_conversation(
    conversation_id: int = Path(..., ge=1, description="Primary key identifier of the conversation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve details of a single conversation.
    Strictly verifies participant authorization (no admin bypass).
    """
    return MessagingService.get_conversation(
        db, conversation_id=conversation_id, current_user=current_user
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message in a conversation",
)
async def send_message(
    conversation_id: int = Path(..., ge=1, description="Primary key identifier of the conversation"),
    payload: MessageCreate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a new message to a conversation.
    Derives sender identity strictly from the authenticated JWT token.
    Dispatches an in-app notification to the recipient.
    Broadcasts real-time event to any connected WebSocket clients.
    """
    msg = MessagingService.send_message(
        db,
        conversation_id=conversation_id,
        current_user=current_user,
        body=payload.body,
    )
    msg_resp = MessagingService._build_message_response(msg)
    await ws_manager.broadcast_to_conversation(
        conversation_id,
        {
            "type": "new_message",
            "message": msg_resp.model_dump(mode="json"),
        },
    )
    return msg_resp


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="List messages in a conversation",
)
def list_messages(
    conversation_id: int = Path(..., ge=1, description="Primary key identifier of the conversation"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Page size (1-100)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve chronological messages in a conversation with database-side pagination.
    Strictly requires participant authorization.
    """
    items, total, total_pages = MessagingService.list_messages(
        db,
        conversation_id=conversation_id,
        current_user=current_user,
        page=page,
        page_size=page_size,
    )
    return MessageListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.patch(
    "/conversations/{conversation_id}/read",
    response_model=MarkReadResponse,
    summary="Mark all received messages in conversation as read",
)
async def mark_conversation_read(
    conversation_id: int = Path(..., ge=1, description="Primary key identifier of the conversation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark all unread messages received by the current user in this conversation as read.
    Sender's own messages are unaffected.
    Broadcasts read receipt event to any connected WebSocket clients.
    """
    count = MessagingService.mark_conversation_read(
        db, conversation_id=conversation_id, current_user=current_user
    )
    if count > 0:
        await ws_manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "messages_read",
                "conversation_id": conversation_id,
                "reader_id": current_user.id,
                "marked_read_count": count,
                "read_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    return MarkReadResponse(
        conversation_id=conversation_id, marked_read_count=count
    )


@router.patch(
    "/messages/{message_id}/read",
    response_model=MessageResponse,
    summary="Mark a single received message as read",
)
async def mark_single_message_read(
    message_id: int = Path(..., ge=1, description="Primary key identifier of the message"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a specific received message as read.
    Sender cannot mark their own sent message as read.
    Broadcasts read receipt event to any connected WebSocket clients.
    """
    msg_resp = MessagingService.mark_single_message_read(
        db, message_id=message_id, current_user=current_user
    )
    await ws_manager.broadcast_to_conversation(
        msg_resp.conversation_id,
        {
            "type": "message_read",
            "conversation_id": msg_resp.conversation_id,
            "message_id": msg_resp.id,
            "reader_id": current_user.id,
            "read_at": msg_resp.read_at.isoformat() if msg_resp.read_at else None,
        },
    )
    return msg_resp
