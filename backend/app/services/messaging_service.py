from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.messaging import (
    ConversationResponse,
    MessageResponse,
    ParticipantSummary,
)
from app.services.notification_service import NotificationService


class MessagingService:
    """
    Business logic layer for CareerBridge one-to-one messaging.
    Handles conversation lifecycle, participant authorization, message delivery,
    read/unread tracking, and notification triggers.
    """

    @staticmethod
    def _build_participant_summary(user: User) -> ParticipantSummary:
        full_name = user.student_profile.full_name if user.student_profile else None
        company_name = (
            user.recruiter_profile.company_name if user.recruiter_profile else None
        )
        return ParticipantSummary(
            id=user.id,
            email=user.email,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            full_name=full_name,
            company_name=company_name,
        )

    @classmethod
    def _build_message_response(cls, msg: Message) -> MessageResponse:
        sender_email = msg.sender.email if msg.sender else None
        return MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            sender_email=sender_email,
            body=msg.body,
            is_read=msg.is_read,
            created_at=msg.created_at,
            read_at=msg.read_at,
            updated_at=msg.updated_at,
        )

    @classmethod
    def _build_conversation_response(
        cls, db: Session, conv: Conversation, current_user_id: int
    ) -> ConversationResponse:
        other_user = conv.user2 if conv.user1_id == current_user_id else conv.user1
        other_summary = cls._build_participant_summary(other_user)

        # Retrieve last message
        last_msg = db.scalar(
            select(Message)
            .options(joinedload(Message.sender))
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        last_msg_resp = cls._build_message_response(last_msg) if last_msg else None

        # Compute unread count for current user
        unread_count = (
            db.scalar(
                select(func.count(Message.id)).where(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user_id,
                    Message.is_read == False,  # noqa: E712
                )
            )
            or 0
        )

        return ConversationResponse(
            id=conv.id,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            other_participant=other_summary,
            last_message=last_msg_resp,
            unread_count=unread_count,
        )

    @classmethod
    def get_or_create_conversation(
        cls,
        db: Session,
        *,
        current_user: User,
        other_user_id: int,
        initial_message: Optional[str] = None,
    ) -> Tuple[ConversationResponse, bool, Optional[MessageResponse]]:
        """
        Create a new one-to-one conversation or retrieve an existing one between two users.
        Validates target existence, active status, and prevents self-messaging.
        """
        if other_user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create conversation with yourself",
            )

        other_user = db.scalar(
            select(User)
            .options(
                joinedload(User.student_profile),
                joinedload(User.recruiter_profile),
            )
            .where(User.id == other_user_id)
        )
        if not other_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found",
            )

        if not other_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start conversation with an inactive user",
            )

        # Normalize participant order for database constraint
        u1 = min(current_user.id, other_user_id)
        u2 = max(current_user.id, other_user_id)

        # Check existing conversation
        existing = db.scalar(
            select(Conversation)
            .options(
                joinedload(Conversation.user1).joinedload(User.student_profile),
                joinedload(Conversation.user1).joinedload(User.recruiter_profile),
                joinedload(Conversation.user2).joinedload(User.student_profile),
                joinedload(Conversation.user2).joinedload(User.recruiter_profile),
            )
            .where(Conversation.user1_id == u1, Conversation.user2_id == u2)
        )

        created = False
        msg_resp = None

        if existing:
            conv = existing
        else:
            try:
                conv = Conversation(user1_id=u1, user2_id=u2)
                p1 = ConversationParticipant(user_id=u1)
                p2 = ConversationParticipant(user_id=u2)
                conv.participants.extend([p1, p2])
                db.add(conv)
                db.commit()
                db.refresh(conv)
                created = True
            except IntegrityError:
                # Concurrent creation race condition handled safely
                db.rollback()
                conv = db.scalar(
                    select(Conversation)
                    .options(
                        joinedload(Conversation.user1).joinedload(User.student_profile),
                        joinedload(Conversation.user1).joinedload(User.recruiter_profile),
                        joinedload(Conversation.user2).joinedload(User.student_profile),
                        joinedload(Conversation.user2).joinedload(User.recruiter_profile),
                    )
                    .where(Conversation.user1_id == u1, Conversation.user2_id == u2)
                )

        if initial_message:
            msg = cls.send_message(
                db,
                conversation_id=conv.id,
                current_user=current_user,
                body=initial_message,
            )
            msg_resp = cls._build_message_response(msg)

        conv_resp = cls._build_conversation_response(db, conv, current_user.id)
        return conv_resp, created, msg_resp

    @classmethod
    def list_conversations(
        cls, db: Session, *, current_user: User
    ) -> List[ConversationResponse]:
        """
        List all conversations for the current user, ordered by most recent activity.
        Strictly excludes conversations belonging to other users.
        """
        conversations = db.scalars(
            select(Conversation)
            .options(
                joinedload(Conversation.user1).joinedload(User.student_profile),
                joinedload(Conversation.user1).joinedload(User.recruiter_profile),
                joinedload(Conversation.user2).joinedload(User.student_profile),
                joinedload(Conversation.user2).joinedload(User.recruiter_profile),
            )
            .where(
                or_(
                    Conversation.user1_id == current_user.id,
                    Conversation.user2_id == current_user.id,
                )
            )
            .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
        ).all()

        return [
            cls._build_conversation_response(db, conv, current_user.id)
            for conv in conversations
        ]

    @classmethod
    def get_conversation(
        cls, db: Session, *, conversation_id: int, current_user: User
    ) -> ConversationResponse:
        """
        Retrieve details of a single conversation with participant authorization.
        Admins cannot bypass participant authorization.
        """
        conv = db.scalar(
            select(Conversation)
            .options(
                joinedload(Conversation.user1).joinedload(User.student_profile),
                joinedload(Conversation.user1).joinedload(User.recruiter_profile),
                joinedload(Conversation.user2).joinedload(User.student_profile),
                joinedload(Conversation.user2).joinedload(User.recruiter_profile),
            )
            .where(Conversation.id == conversation_id)
        )
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if current_user.id not in (conv.user1_id, conv.user2_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this conversation",
            )

        return cls._build_conversation_response(db, conv, current_user.id)

    @classmethod
    def send_message(
        cls, db: Session, *, conversation_id: int, current_user: User, body: str
    ) -> Message:
        """
        Send a new message in a conversation.
        Derives sender_id strictly from current_user.id.
        Notifies recipient via NotificationService.
        """
        cleaned_body = body.strip() if body else ""
        if not cleaned_body:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Message body cannot be empty or whitespace only",
            )
        if len(cleaned_body) > 5000:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Message body cannot exceed 5000 characters",
            )

        conv = db.scalar(
            select(Conversation)
            .options(
                joinedload(Conversation.user1),
                joinedload(Conversation.user2),
            )
            .where(Conversation.id == conversation_id)
        )
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if current_user.id not in (conv.user1_id, conv.user2_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to send messages in this conversation",
            )

        msg = Message(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            body=cleaned_body,
            is_read=False,
        )
        db.add(msg)
        conv.updated_at = func.now()

        # Emit in-app notification to the other participant
        other_user_id = (
            conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
        )
        preview = (
            cleaned_body[:80] + "..." if len(cleaned_body) > 80 else cleaned_body
        )
        NotificationService.create_notification(
            db,
            user_id=other_user_id,
            notification_type=NotificationType.MESSAGE_RECEIVED,
            title=f"New message from {current_user.email}",
            message=preview,
            commit=False,
        )

        db.commit()
        db.refresh(msg)
        return msg

    @classmethod
    def list_messages(
        cls,
        db: Session,
        *,
        conversation_id: int,
        current_user: User,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[MessageResponse], int, int]:
        """
        Retrieve paginated messages for a conversation, ordered chronologically.
        Validates participant authorization strictly.
        """
        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Page must be greater than or equal to 1",
            )
        if page_size < 1 or page_size > 100:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Page size must be between 1 and 100",
            )

        conv = db.scalar(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if current_user.id not in (conv.user1_id, conv.user2_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access messages in this conversation",
            )

        total = (
            db.scalar(
                select(func.count(Message.id)).where(
                    Message.conversation_id == conversation_id
                )
            )
            or 0
        )

        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        messages = db.scalars(
            select(Message)
            .options(joinedload(Message.sender))
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc(), Message.id.asc())
            .offset(offset)
            .limit(page_size)
        ).all()

        message_responses = [cls._build_message_response(m) for m in messages]
        return message_responses, total, total_pages

    @classmethod
    def mark_conversation_read(
        cls, db: Session, *, conversation_id: int, current_user: User
    ) -> int:
        """
        Mark all unread messages received by current user in the conversation as read.
        Does not alter read status of messages sent by current user.
        """
        conv = db.scalar(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if current_user.id not in (conv.user1_id, conv.user2_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update read state in this conversation",
            )

        now_utc = datetime.now(timezone.utc)
        stmt = (
            update(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != current_user.id,
                Message.is_read == False,  # noqa: E712
            )
            .values(is_read=True, read_at=now_utc)
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount

    @classmethod
    def mark_single_message_read(
        cls, db: Session, *, message_id: int, current_user: User
    ) -> MessageResponse:
        """
        Mark a specific message received by current user as read.
        Rejects sender attempts to mark own messages read.
        """
        msg = db.scalar(
            select(Message)
            .options(
                joinedload(Message.conversation),
                joinedload(Message.sender),
            )
            .where(Message.id == message_id)
        )
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found",
            )

        conv = msg.conversation
        if current_user.id not in (conv.user1_id, conv.user2_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this message",
            )

        if msg.sender_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot mark your own sent message as read",
            )

        if not msg.is_read:
            msg.is_read = True
            msg.read_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(msg)

        return cls._build_message_response(msg)
