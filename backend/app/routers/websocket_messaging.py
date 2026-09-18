import json
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.conversation import Conversation
from app.models.user import User
from app.services.messaging_service import MessagingService
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Real-Time Messaging"])


def _extract_token(websocket: WebSocket) -> Optional[str]:
    """
    Extract authentication token from query parameter or authorization header.
    Primary: ?token=<jwt>
    Fallback: Authorization: Bearer <jwt> or Sec-WebSocket-Protocol: <jwt>
    """
    token = websocket.query_params.get("token")
    if token:
        return token.strip()

    auth_header = websocket.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    sec_proto = websocket.headers.get("sec-websocket-protocol")
    if sec_proto:
        return sec_proto.strip()

    return None


@router.websocket("/ws/conversations/{conversation_id}")
async def websocket_conversation_endpoint(
    websocket: WebSocket,
    conversation_id: int,
):
    """
    Real-time WebSocket endpoint for two-way conversation messaging.
    Strictly enforces:
    1. Authentication: Valid, active JWT token required in handshake.
    2. Authorization: Current user must be a registered participant in the conversation.
       Platform administrators do NOT have bypass access to private conversations.
    3. Persistence: All messages are saved to PostgreSQL via MessagingService.
    4. Notifications: In-app notifications are dispatched to offline/online recipients.
    5. Multi-Tab: Multiple active connections per user are tracked and synchronized.
    """
    # 1. Extract Token
    token = _extract_token(websocket)
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing authentication token",
        )
        return

    # 2. Decode & Validate Token Signature / Expiration
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Invalid token claims: subject missing",
            )
            return
        user_id = int(sub)
    except Exception:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid or expired token",
        )
        return

    # 3. Validate User Existence, Active Status, and Conversation Participant Authorization
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.id == user_id))
        if not user or not user.is_active:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="User not found or account inactive",
            )
            return

        conv = db.scalar(select(Conversation).where(Conversation.id == conversation_id))
        if not conv:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Conversation not found",
            )
            return

        # Strict participant check — NO admin bypass for private messaging
        if user_id not in (conv.user1_id, conv.user2_id):
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Not authorized: not a conversation participant",
            )
            return
    finally:
        db.close()

    # 4. Accept Connection & Register with Connection Manager
    await ws_manager.connect(conversation_id, user_id, websocket)

    # 5. Receive & Dispatch Message Loop
    try:
        while True:
            data = await websocket.receive_text()

            # Parse JSON payload
            try:
                event = json.loads(data)
            except (json.JSONDecodeError, UnicodeDecodeError):
                await websocket.send_json({
                    "type": "error",
                    "code": "MALFORMED_JSON",
                    "message": "Payload must be valid JSON",
                })
                continue

            if not isinstance(event, dict):
                await websocket.send_json({
                    "type": "error",
                    "code": "MALFORMED_JSON",
                    "message": "JSON payload must be an object",
                })
                continue

            event_type = event.get("type")

            # Heartbeat ping
            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # Send Message Event
            elif event_type == "message":
                body = event.get("body")
                if body is None or not isinstance(body, str):
                    await websocket.send_json({
                        "type": "error",
                        "code": "INVALID_MESSAGE",
                        "message": "Message body is required and must be a string",
                    })
                    continue

                cleaned_body = body.strip()
                if not cleaned_body:
                    await websocket.send_json({
                        "type": "error",
                        "code": "INVALID_MESSAGE",
                        "message": "Message body cannot be empty or whitespace only",
                    })
                    continue

                if len(cleaned_body) > 5000:
                    await websocket.send_json({
                        "type": "error",
                        "code": "MESSAGE_TOO_LONG",
                        "message": "Message body cannot exceed 5000 characters",
                    })
                    continue

                # Persist message to PostgreSQL via MessagingService
                # Sender ID is derived strictly from authenticated user_id
                db = SessionLocal()
                try:
                    current_user = db.scalar(select(User).where(User.id == user_id))
                    if not current_user or not current_user.is_active:
                        await websocket.send_json({
                            "type": "error",
                            "code": "AUTHENTICATION_FAILED",
                            "message": "User account inactive or missing",
                        })
                        break

                    msg = MessagingService.send_message(
                        db,
                        conversation_id=conversation_id,
                        current_user=current_user,
                        body=cleaned_body,
                    )
                    msg_resp = MessagingService._build_message_response(msg)
                    broadcast_payload = {
                        "type": "new_message",
                        "message": msg_resp.model_dump(mode="json"),
                    }
                except HTTPException as exc:
                    await websocket.send_json({
                        "type": "error",
                        "code": "OPERATION_FAILED",
                        "message": exc.detail,
                    })
                    continue
                except Exception as exc:
                    logger.error("Error persisting WebSocket message: %s", exc)
                    await websocket.send_json({
                        "type": "error",
                        "code": "SERVER_ERROR",
                        "message": "Failed to persist message",
                    })
                    continue
                finally:
                    db.close()

                # Broadcast to all active sockets of participants in the conversation
                await ws_manager.broadcast_to_conversation(
                    conversation_id, broadcast_payload
                )

            # Mark Read Event
            elif event_type in ("read", "mark_read"):
                db = SessionLocal()
                try:
                    current_user = db.scalar(select(User).where(User.id == user_id))
                    if current_user and current_user.is_active:
                        count = MessagingService.mark_conversation_read(
                            db,
                            conversation_id=conversation_id,
                            current_user=current_user,
                        )
                        now_utc = datetime.now(timezone.utc).isoformat()
                        read_payload = {
                            "type": "messages_read",
                            "conversation_id": conversation_id,
                            "reader_id": user_id,
                            "marked_read_count": count,
                            "read_at": now_utc,
                        }
                        await ws_manager.broadcast_to_conversation(
                            conversation_id, read_payload
                        )
                except Exception as exc:
                    logger.error("Error marking messages read via WebSocket: %s", exc)
                finally:
                    db.close()

            else:
                await websocket.send_json({
                    "type": "error",
                    "code": "UNSUPPORTED_EVENT",
                    "message": f"Unsupported event type: '{event_type}'",
                })
                continue

    except WebSocketDisconnect:
        logger.info(
            "WebSocket client disconnected: user_id=%d in conversation_id=%d",
            user_id,
            conversation_id,
        )
    except Exception as exc:
        logger.warning(
            "WebSocket unexpected exception: user_id=%d in conversation_id=%d: %s",
            user_id,
            conversation_id,
            exc,
        )
    finally:
        ws_manager.disconnect(conversation_id, user_id, websocket)
