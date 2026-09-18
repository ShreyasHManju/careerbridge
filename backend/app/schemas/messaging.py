from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConversationCreate(BaseModel):
    other_user_id: int = Field(..., gt=0, description="Target user ID to start conversation with")
    initial_message: Optional[str] = Field(
        None,
        description="Optional initial message text",
    )

    @field_validator("initial_message")
    @classmethod
    def validate_initial_message(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not isinstance(v, str):
                raise ValueError("Initial message must be a string")
            v = v.strip()
            if not v:
                raise ValueError("Initial message cannot be empty or whitespace only")
            if len(v) > 5000:
                raise ValueError("Initial message cannot exceed 5000 characters")
        return v


class ParticipantSummary(BaseModel):
    id: int
    email: str
    role: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    body: str = Field(..., description="Message text content")

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("Message body must be a string")
        v = v.strip()
        if not v:
            raise ValueError("Message body cannot be empty or whitespace only")
        if len(v) > 5000:
            raise ValueError("Message body cannot exceed 5000 characters")
        return v


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_email: Optional[str] = None
    body: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    other_participant: ParticipantSummary
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    items: List[ConversationResponse]
    total: int


class MessageListResponse(BaseModel):
    items: List[MessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MarkReadResponse(BaseModel):
    conversation_id: int
    marked_read_count: int
