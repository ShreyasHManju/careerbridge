"""
CareerBridge Phase 20 Real-Time Messaging / WebSockets Foundation Test Suite
Covers:
1. WebSocket Handshake Authentication (missing, invalid, tampered, expired, inactive user)
2. WebSocket Handshake Authorization (conversation participant check, admin non-participant rejection)
3. Connection Manager Lifecycle (connect, disconnect, multi-tab support, pruning dead sockets)
4. Message Inbound Validation & Error Handling (empty, whitespace, oversized, malformed JSON, unsupported event, ping/pong)
5. Message Persistence & Sender Verification (database commit, sender identity bound to JWT, prevent spoofing)
6. Real-Time Broadcast & Delivery (recipient receipt, sender echo, multi-tab sync, conversation isolation, offline recipient, HTTP send broadcast)
7. Read State & Receipts (delivery does not auto-mark read, WS read event, HTTP read broadcast)
8. Notifications & Security (in-app notification dispatched to recipient, no self-notification, no password hash leaks)
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import jwt
from starlette.websockets import WebSocketDisconnect

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.websocket_manager import ws_manager

client = TestClient(app)

WS_STUDENT1_EMAIL = "ws.student1@careerbridge.io"
WS_STUDENT2_EMAIL = "ws.student2@careerbridge.io"
WS_RECRUITER1_EMAIL = "ws.recruiter1@careerbridge.io"
WS_RECRUITER2_EMAIL = "ws.recruiter2@careerbridge.io"
WS_ADMIN_EMAIL = "ws.admin@careerbridge.io"
WS_INACTIVE_EMAIL = "ws.inactive@careerbridge.io"
TEST_PASSWORD = "WsTestPassword123!"


def setup_module():
    """Seed test users, profiles, and initial test conversations."""
    teardown_module()
    ws_manager.clear()
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        stu1 = User(
            email=WS_STUDENT1_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        stu2 = User(
            email=WS_STUDENT2_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        rec1 = User(
            email=WS_RECRUITER1_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        rec2 = User(
            email=WS_RECRUITER2_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        admin = User(
            email=WS_ADMIN_EMAIL,
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        inactive = User(
            email=WS_INACTIVE_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=False,
            is_verified=True,
        )
        db.add_all([stu1, stu2, rec1, rec2, admin, inactive])
        db.commit()
        db.refresh(stu1)
        db.refresh(stu2)
        db.refresh(rec1)
        db.refresh(rec2)

        sp1 = StudentProfile(
            user_id=stu1.id,
            full_name="WS Alice Candidate",
            college="MIT",
            degree="B.S.",
            branch="Computer Science",
            graduation_year=2026,
            skills=["Python", "FastAPI"],
        )
        sp2 = StudentProfile(
            user_id=stu2.id,
            full_name="WS Bob Applicant",
            college="Stanford",
            degree="B.S.",
            branch="Software Engineering",
            graduation_year=2025,
            skills=["React", "TypeScript"],
        )
        rp1 = RecruiterProfile(
            user_id=rec1.id,
            company_name="WS Alpha Innovations",
            is_verified=True,
        )
        rp2 = RecruiterProfile(
            user_id=rec2.id,
            company_name="WS Beta Systems",
            is_verified=True,
        )
        db.add_all([sp1, sp2, rp1, rp2])
        db.commit()

        # Create Conversation 1 (stu1 & rec1)
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv1 = Conversation(user1_id=u1, user2_id=u2)
        p1 = ConversationParticipant(user_id=u1)
        p2 = ConversationParticipant(user_id=u2)
        conv1.participants.extend([p1, p2])

        # Create Conversation 2 (stu2 & rec2)
        u3 = min(stu2.id, rec2.id)
        u4 = max(stu2.id, rec2.id)
        conv2 = Conversation(user1_id=u3, user2_id=u4)
        p3 = ConversationParticipant(user_id=u3)
        p4 = ConversationParticipant(user_id=u4)
        conv2.participants.extend([p3, p4])

        db.add_all([conv1, conv2])
        db.commit()


def teardown_module():
    """Purge test users and all cascading conversations and messages."""
    ws_manager.clear()
    emails = [
        WS_STUDENT1_EMAIL,
        WS_STUDENT2_EMAIL,
        WS_RECRUITER1_EMAIL,
        WS_RECRUITER2_EMAIL,
        WS_ADMIN_EMAIL,
        WS_INACTIVE_EMAIL,
    ]
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.in_(emails))).all()
        for u in users:
            db.delete(u)
        db.commit()


def get_user(email: str) -> User:
    with SessionLocal() as db:
        return db.scalar(select(User).where(User.email == email))


def get_token(email: str) -> str:
    user = get_user(email)
    return create_access_token(subject=user.id)


def get_conversation_between(email1: str, email2: str) -> Conversation:
    u1 = get_user(email1)
    u2 = get_user(email2)
    p1 = min(u1.id, u2.id)
    p2 = max(u1.id, u2.id)
    with SessionLocal() as db:
        return db.scalar(
            select(Conversation).where(
                Conversation.user1_id == p1, Conversation.user2_id == p2
            )
        )


# =====================================================================
# GROUP 1: WEBSOCKET HANDSHAKE AUTHENTICATION (9 TESTS)
# =====================================================================


def test_ws_auth_missing_token_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(f"/api/v1/ws/conversations/{conv.id}") as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect with code 1008 for missing token"
    print("PASS: test_ws_auth_missing_token_rejected")


def test_ws_auth_invalid_token_format_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv.id}?token=invalid.token.here"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect with code 1008 for invalid token format"
    print("PASS: test_ws_auth_invalid_token_format_rejected")


def test_ws_auth_tampered_signature_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    tampered_jwt = jwt.encode(
        {"sub": str(stu1.id), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "completely_wrong_secret_key_123456",
        algorithm="HS256",
    )
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv.id}?token={tampered_jwt}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for tampered signature"
    print("PASS: test_ws_auth_tampered_signature_rejected")


def test_ws_auth_expired_token_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    expired_token = create_access_token(
        subject=stu1.id, expires_delta=timedelta(seconds=-10)
    )
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv.id}?token={expired_token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for expired token"
    print("PASS: test_ws_auth_expired_token_rejected")


def test_ws_auth_token_missing_sub_claim_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token_without_sub = jwt.encode(
        {"exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv.id}?token={token_without_sub}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for token missing sub claim"
    print("PASS: test_ws_auth_token_missing_sub_claim_rejected")


def test_ws_auth_nonexistent_user_token_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    phantom_token = create_access_token(subject=9999999)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv.id}?token={phantom_token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for nonexistent user"
    print("PASS: test_ws_auth_nonexistent_user_token_rejected")


def test_ws_auth_inactive_user_token_rejected():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    inactive_token = get_token(WS_INACTIVE_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv.id}?token={inactive_token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for inactive user"
    print("PASS: test_ws_auth_inactive_user_token_rejected")


def test_ws_auth_header_bearer_token_accepted():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token = get_token(WS_STUDENT1_EMAIL)
    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv.id}",
        headers={"authorization": f"Bearer {token}"},
    ) as ws:
        ws.send_json({"type": "ping"})
        data = ws.receive_json()
        assert data["type"] == "pong"
    print("PASS: test_ws_auth_header_bearer_token_accepted")


def test_ws_auth_sec_websocket_protocol_token_accepted():
    conv = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token = get_token(WS_STUDENT1_EMAIL)
    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv.id}",
        headers={"sec-websocket-protocol": token},
    ) as ws:
        ws.send_json({"type": "ping"})
        data = ws.receive_json()
        assert data["type"] == "pong"
    print("PASS: test_ws_auth_sec_websocket_protocol_token_accepted")


# =====================================================================
# GROUP 2: WEBSOCKET HANDSHAKE AUTHORIZATION (5 TESTS)
# =====================================================================


def test_ws_authz_nonexistent_conversation_rejected():
    token = get_token(WS_STUDENT1_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/999999?token={token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for nonexistent conversation"
    print("PASS: test_ws_authz_nonexistent_conversation_rejected")


def test_ws_authz_non_participant_student_rejected():
    # conv1 is between student1 & recruiter1; student2 attempts to join
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token = get_token(WS_STUDENT2_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for non-participant student"
    print("PASS: test_ws_authz_non_participant_student_rejected")


def test_ws_authz_non_participant_recruiter_rejected():
    # conv1 is between student1 & recruiter1; recruiter2 attempts to join
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token = get_token(WS_RECRUITER2_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Expected WebSocketDisconnect 1008 for non-participant recruiter"
    print("PASS: test_ws_authz_non_participant_recruiter_rejected")


def test_ws_authz_admin_non_participant_strictly_rejected():
    # conv1 is between student1 & recruiter1; Admin attempts to join (NO ADMIN BYPASS)
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token = get_token(WS_ADMIN_EMAIL)
    disconnected = False
    try:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token}"
        ) as ws:
            pass
    except WebSocketDisconnect as e:
        assert e.code == 1008
        disconnected = True
    assert disconnected, "Admin MUST NOT bypass conversation authorization; expected 1008"
    print("PASS: test_ws_authz_admin_non_participant_strictly_rejected")


def test_ws_authz_both_participants_connect_succeeds():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        ws1.send_json({"type": "ping"})
        assert ws1.receive_json()["type"] == "pong"

        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
        ) as ws2:
            ws2.send_json({"type": "ping"})
            assert ws2.receive_json()["type"] == "pong"
    print("PASS: test_ws_authz_both_participants_connect_succeeds")


# =====================================================================
# GROUP 3: CONNECTION MANAGER LIFECYCLE & MULTI-TAB (6 TESTS)
# =====================================================================


def test_ws_manager_registers_on_connect():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    assert ws_manager.connection_count(conv1.id) == 0
    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        assert ws_manager.connection_count(conv1.id) == 1
        assert stu1.id in ws_manager.get_active_users(conv1.id)
    print("PASS: test_ws_manager_registers_on_connect")


def test_ws_manager_unregisters_on_disconnect():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        assert ws_manager.connection_count(conv1.id) == 1

    # After exit stack, connection count drops back to 0
    assert ws_manager.connection_count(conv1.id) == 0
    assert conv1.id not in ws_manager._connections
    print("PASS: test_ws_manager_unregisters_on_disconnect")


def test_ws_multi_tab_same_user():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
        ) as ws2:
            assert ws_manager.connection_count(conv1.id) == 2
            assert len(ws_manager._connections[conv1.id][stu1.id]) == 2
    assert ws_manager.connection_count(conv1.id) == 0
    print("PASS: test_ws_multi_tab_same_user")


def test_ws_multi_tab_partial_disconnect():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
        ) as ws2:
            assert ws_manager.connection_count(conv1.id) == 2
        # ws2 disconnected, ws1 remains open
        assert ws_manager.connection_count(conv1.id) == 1
        assert len(ws_manager._connections[conv1.id][stu1.id]) == 1
    assert ws_manager.connection_count(conv1.id) == 0
    print("PASS: test_ws_multi_tab_partial_disconnect")


def test_ws_get_active_users():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    rec1 = get_user(WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        assert ws_manager.get_active_users(conv1.id) == {stu1.id}
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
        ) as ws2:
            assert ws_manager.get_active_users(conv1.id) == {stu1.id, rec1.id}
    assert ws_manager.get_active_users(conv1.id) == set()
    print("PASS: test_ws_get_active_users")


def test_ws_dead_socket_pruned_during_broadcast():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    class MockFailingWebSocket:
        async def send_json(self, payload):
            raise RuntimeError("Broken pipe simulated")

    fake_ws = MockFailingWebSocket()
    stu1 = get_user(WS_STUDENT1_EMAIL)

    # Manually register the fake socket
    if conv1.id not in ws_manager._connections:
        ws_manager._connections[conv1.id] = {}
    if stu1.id not in ws_manager._connections[conv1.id]:
        ws_manager._connections[conv1.id][stu1.id] = set()
    ws_manager._connections[conv1.id][stu1.id].add(fake_ws)

    assert ws_manager.connection_count(conv1.id) == 1

    # Broadcast payload: should catch the exception and prune the dead socket
    import asyncio
    asyncio.run(
        ws_manager.broadcast_to_conversation(conv1.id, {"type": "test_broadcast"})
    )
    assert ws_manager.connection_count(conv1.id) == 0
    print("PASS: test_ws_dead_socket_pruned_during_broadcast")


# =====================================================================
# GROUP 4: INBOUND MESSAGE VALIDATION & ERROR HANDLING (9 TESTS)
# =====================================================================


def test_ws_msg_empty_body_rejected():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": ""})
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "INVALID_MESSAGE"
    print("PASS: test_ws_msg_empty_body_rejected")


def test_ws_msg_whitespace_only_rejected():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": "   \n\t  "})
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "INVALID_MESSAGE"
    print("PASS: test_ws_msg_whitespace_only_rejected")


def test_ws_msg_missing_body_rejected():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message"})
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "INVALID_MESSAGE"
    print("PASS: test_ws_msg_missing_body_rejected")


def test_ws_msg_non_string_body_rejected():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": 12345})
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "INVALID_MESSAGE"
    print("PASS: test_ws_msg_non_string_body_rejected")


def test_ws_msg_oversized_body_rejected():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        oversized = "x" * 5001
        ws.send_json({"type": "message", "body": oversized})
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "MESSAGE_TOO_LONG"
    print("PASS: test_ws_msg_oversized_body_rejected")


def test_ws_msg_malformed_json_handled():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_text("this is not json at all {{{")
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "MALFORMED_JSON"
        # Connection stays alive!
        ws.send_json({"type": "ping"})
        assert ws.receive_json()["type"] == "pong"
    print("PASS: test_ws_msg_malformed_json_handled")


def test_ws_msg_non_dict_json_handled():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_text("[1, 2, 3]")
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "MALFORMED_JSON"
    print("PASS: test_ws_msg_non_dict_json_handled")


def test_ws_msg_unsupported_event_type():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "arbitrary_unknown_action"})
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert resp["code"] == "UNSUPPORTED_EVENT"
    print("PASS: test_ws_msg_unsupported_event_type")


def test_ws_ping_pong_heartbeat():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        for _ in range(3):
            ws.send_json({"type": "ping"})
            resp = ws.receive_json()
            assert resp["type"] == "pong"
    print("PASS: test_ws_ping_pong_heartbeat")


# =====================================================================
# GROUP 5: MESSAGE PERSISTENCE & SENDER VERIFICATION (4 TESTS)
# =====================================================================


def test_ws_msg_persists_to_database():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    unique_text = f"Persistence check message {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": unique_text})
        resp = ws.receive_json()
        assert resp["type"] == "new_message"
        msg_data = resp["message"]
        assert msg_data["body"] == unique_text
        assert msg_data["sender_id"] == stu1.id
        assert msg_data["conversation_id"] == conv1.id

    # Verify directly in PostgreSQL
    with SessionLocal() as db:
        saved_msg = db.scalar(
            select(Message).where(Message.body == unique_text)
        )
        assert saved_msg is not None
        assert saved_msg.sender_id == stu1.id
        assert saved_msg.conversation_id == conv1.id
        assert saved_msg.is_read is False
    print("PASS: test_ws_msg_persists_to_database")


def test_ws_sender_id_strictly_derived_from_jwt():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    rec1 = get_user(WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    spoof_text = f"Spoof test attempt {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        # Client tries to claim recruiter1 sent the message
        ws.send_json({
            "type": "message",
            "body": spoof_text,
            "sender_id": rec1.id,
        })
        resp = ws.receive_json()
        assert resp["type"] == "new_message"
        msg_data = resp["message"]
        # Server MUST have ignored the spoofed sender_id!
        assert msg_data["sender_id"] == stu1.id

    with SessionLocal() as db:
        saved = db.scalar(select(Message).where(Message.body == spoof_text))
        assert saved is not None
        assert saved.sender_id == stu1.id
    print("PASS: test_ws_sender_id_strictly_derived_from_jwt")


def test_ws_message_associates_correct_conversation():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    text = "Conversation association verification"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": text})
        resp = ws.receive_json()
        assert resp["message"]["conversation_id"] == conv1.id
    print("PASS: test_ws_message_associates_correct_conversation")


def test_ws_database_consistency_with_http_list():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    text = f"HTTP consistency test {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": text})
        ws.receive_json()

    # Query via HTTP GET endpoint
    res = client.get(
        f"/api/v1/conversations/{conv1.id}/messages",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(m["body"] == text for m in items)
    print("PASS: test_ws_database_consistency_with_http_list")


# =====================================================================
# GROUP 6: REAL-TIME BROADCAST & MULTI-CLIENT DISTRIBUTION (6 TESTS)
# =====================================================================


def test_ws_realtime_broadcast_to_recipient():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    test_text = "Real-time delivery to recipient test"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as sender_ws:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
        ) as recipient_ws:
            sender_ws.send_json({"type": "message", "body": test_text})

            sender_recv = sender_ws.receive_json()
            recipient_recv = recipient_ws.receive_json()

            assert sender_recv["type"] == "new_message"
            assert sender_recv["message"]["body"] == test_text

            assert recipient_recv["type"] == "new_message"
            assert recipient_recv["message"]["body"] == test_text
            assert recipient_recv["message"]["sender_email"] == WS_STUDENT1_EMAIL
    print("PASS: test_ws_realtime_broadcast_to_recipient")


def test_ws_realtime_broadcast_to_sender():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    test_text = "Sender confirmation broadcast test"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
    ) as ws:
        ws.send_json({"type": "message", "body": test_text})
        resp = ws.receive_json()
        assert resp["type"] == "new_message"
        assert resp["message"]["body"] == test_text
        assert resp["message"]["sender_email"] == WS_RECRUITER1_EMAIL
    print("PASS: test_ws_realtime_broadcast_to_sender")


def test_ws_realtime_broadcast_to_multiple_tabs():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    multi_tab_text = "Broadcast across tabs test"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as sender_ws:
        # Recruiter opens two tabs
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
        ) as tab1:
            with client.websocket_connect(
                f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
            ) as tab2:
                sender_ws.send_json({"type": "message", "body": multi_tab_text})

                sender_recv = sender_ws.receive_json()
                tab1_recv = tab1.receive_json()
                tab2_recv = tab2.receive_json()

                assert tab1_recv["message"]["body"] == multi_tab_text
                assert tab2_recv["message"]["body"] == multi_tab_text
    print("PASS: test_ws_realtime_broadcast_to_multiple_tabs")


def test_ws_conversation_isolation():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    conv2 = get_conversation_between(WS_STUDENT2_EMAIL, WS_RECRUITER2_EMAIL)

    token1 = get_token(WS_STUDENT1_EMAIL)
    token_stu2 = get_token(WS_STUDENT2_EMAIL)
    secret_text = "Private conversation 1 secret content"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as conv1_ws:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv2.id}?token={token_stu2}"
        ) as conv2_ws:
            conv1_ws.send_json({"type": "message", "body": secret_text})
            conv1_recv = conv1_ws.receive_json()
            assert conv1_recv["message"]["body"] == secret_text

            # conv2_ws should ping/pong cleanly without receiving conv1's message
            conv2_ws.send_json({"type": "ping"})
            conv2_recv = conv2_ws.receive_json()
            assert conv2_recv["type"] == "pong"
    print("PASS: test_ws_conversation_isolation")


def test_ws_offline_recipient_delivery():
    # Recruiter is offline (not connected)
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    offline_msg_text = f"Message while offline {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as sender_ws:
        sender_ws.send_json({"type": "message", "body": offline_msg_text})
        sender_recv = sender_ws.receive_json()
        assert sender_recv["message"]["body"] == offline_msg_text

    # Recruiter logs in later via HTTP and retrieves it
    res = client.get(
        f"/api/v1/conversations/{conv1.id}/messages",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res.status_code == 200
    bodies = [m["body"] for m in res.json()["items"]]
    assert offline_msg_text in bodies
    print("PASS: test_ws_offline_recipient_delivery")


def test_ws_http_send_broadcasts_to_active_ws():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    http_text = f"Message sent via HTTP API {datetime.now(timezone.utc).isoformat()}"

    # Student has active WebSocket open
    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        # Recruiter posts message via HTTP endpoint
        res = client.post(
            f"/api/v1/conversations/{conv1.id}/messages",
            headers={"Authorization": f"Bearer {token2}"},
            json={"body": http_text},
        )
        assert res.status_code == 201

        # Student's WebSocket receives the message in real-time
        ws_recv = ws.receive_json()
        assert ws_recv["type"] == "new_message"
        assert ws_recv["message"]["body"] == http_text
        assert ws_recv["message"]["sender_email"] == WS_RECRUITER1_EMAIL
    print("PASS: test_ws_http_send_broadcasts_to_active_ws")


# =====================================================================
# GROUP 7: READ STATE & RECEIPTS (4 TESTS)
# =====================================================================


def test_ws_delivered_message_remains_unread():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    text = f"Unread test {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
        ) as ws2:
            ws1.send_json({"type": "message", "body": text})
            m1 = ws1.receive_json()
            resp = ws2.receive_json()
            # Delivering over WebSocket MUST NOT automatically mark it read!
            assert resp["message"]["is_read"] is False
            msg_id = resp["message"]["id"]

            with SessionLocal() as db:
                saved = db.scalar(select(Message).where(Message.id == msg_id))
                assert saved.is_read is False
                assert saved.read_at is None
    print("PASS: test_ws_delivered_message_remains_unread")


def test_ws_mark_read_event_updates_database():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)
    text = f"Read event test {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
        ) as ws2:
            ws1.send_json({"type": "message", "body": text})
            m1 = ws1.receive_json()
            m2 = ws2.receive_json()
            msg_id = m2["message"]["id"]

            # Recruiter sends "read" event over WebSocket
            ws2.send_json({"type": "read"})
            receipt2 = ws2.receive_json()
            receipt1 = ws1.receive_json()

            assert receipt1["type"] == "messages_read"
            assert receipt1["conversation_id"] == conv1.id
            assert receipt2["type"] == "messages_read"

            with SessionLocal() as db:
                msg = db.scalar(select(Message).where(Message.id == msg_id))
                assert msg.is_read is True
                assert msg.read_at is not None
    print("PASS: test_ws_mark_read_event_updates_database")


def test_ws_mark_read_event_broadcasts_receipt():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token2}"
    ) as ws2:
        ws2.send_json({"type": "read"})
        receipt = ws2.receive_json()
        assert receipt["type"] == "messages_read"
        assert receipt["conversation_id"] == conv1.id
        assert "read_at" in receipt
    print("PASS: test_ws_mark_read_event_broadcasts_receipt")


def test_ws_http_read_broadcasts_to_active_ws():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)

    # First send a message from student to recruiter
    send_res = client.post(
        f"/api/v1/conversations/{conv1.id}/messages",
        headers={"Authorization": f"Bearer {token1}"},
        json={"body": "Mark read HTTP sync test"},
    )
    assert send_res.status_code == 201

    # Student opens WebSocket
    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        # Recruiter marks conversation read via HTTP PATCH
        read_res = client.patch(
            f"/api/v1/conversations/{conv1.id}/read",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert read_res.status_code == 200

        # Student's WebSocket receives real-time read receipt!
        ws_receipt = ws1.receive_json()
        assert ws_receipt["type"] == "messages_read"
        assert ws_receipt["conversation_id"] == conv1.id
    print("PASS: test_ws_http_read_broadcasts_to_active_ws")


# =====================================================================
# GROUP 8: NOTIFICATIONS & SECURITY (5 TESTS)
# =====================================================================


def test_ws_notification_created_for_recipient():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    rec1 = get_user(WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    notify_text = f"Notification trigger test {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": notify_text})
        ws.receive_json()

    with SessionLocal() as db:
        notif = db.scalar(
            select(Notification)
            .where(
                Notification.user_id == rec1.id,
                Notification.notification_type == NotificationType.MESSAGE_RECEIVED,
                Notification.message.contains(notify_text[:40]),
            )
            .order_by(Notification.created_at.desc())
        )
        assert notif is not None
        assert f"New message from {stu1.email}" in notif.title
    print("PASS: test_ws_notification_created_for_recipient")


def test_ws_no_notification_for_sender():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    stu1 = get_user(WS_STUDENT1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    no_self_text = f"No self notif {datetime.now(timezone.utc).isoformat()}"

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": no_self_text})
        ws.receive_json()

    with SessionLocal() as db:
        self_notifs = db.scalars(
            select(Notification).where(
                Notification.user_id == stu1.id,
                Notification.message.contains(no_self_text[:40]),
            )
        ).all()
        assert len(self_notifs) == 0
    print("PASS: test_ws_no_notification_for_sender")


def test_ws_no_password_hash_leakage_in_ws():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws:
        ws.send_json({"type": "message", "body": "Sensitive credential leakage check"})
        raw_json = ws.receive_text()
        assert "password_hash" not in raw_json.lower()
        assert "hashed_password" not in raw_json.lower()
    print("PASS: test_ws_no_password_hash_leakage_in_ws")


def test_ws_repeated_connections_clean_state():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)

    for i in range(5):
        with client.websocket_connect(
            f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
        ) as ws:
            ws.send_json({"type": "ping"})
            assert ws.receive_json()["type"] == "pong"
        assert ws_manager.connection_count() == 0
    print("PASS: test_ws_repeated_connections_clean_state")


def test_ws_mark_single_message_read_http_broadcasts():
    conv1 = get_conversation_between(WS_STUDENT1_EMAIL, WS_RECRUITER1_EMAIL)
    token1 = get_token(WS_STUDENT1_EMAIL)
    token2 = get_token(WS_RECRUITER1_EMAIL)

    # Student sends message via HTTP
    res = client.post(
        f"/api/v1/conversations/{conv1.id}/messages",
        headers={"Authorization": f"Bearer {token1}"},
        json={"body": "Single message read test via HTTP"},
    )
    assert res.status_code == 201
    msg_id = res.json()["id"]

    # Student opens WebSocket
    with client.websocket_connect(
        f"/api/v1/ws/conversations/{conv1.id}?token={token1}"
    ) as ws1:
        # Recruiter marks the single message read via HTTP PATCH
        patch_res = client.patch(
            f"/api/v1/messages/{msg_id}/read",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert patch_res.status_code == 200

        # Student WebSocket receives single message read event
        ws_recv = ws1.receive_json()
        assert ws_recv["type"] == "message_read"
        assert ws_recv["message_id"] == msg_id
        assert ws_recv["conversation_id"] == conv1.id
    print("PASS: test_ws_mark_single_message_read_http_broadcasts")


# =====================================================================
# MAIN RUNNER
# =====================================================================

if __name__ == "__main__":
    setup_module()
    try:
        # Group 1
        test_ws_auth_missing_token_rejected()
        test_ws_auth_invalid_token_format_rejected()
        test_ws_auth_tampered_signature_rejected()
        test_ws_auth_expired_token_rejected()
        test_ws_auth_token_missing_sub_claim_rejected()
        test_ws_auth_nonexistent_user_token_rejected()
        test_ws_auth_inactive_user_token_rejected()
        test_ws_auth_header_bearer_token_accepted()
        test_ws_auth_sec_websocket_protocol_token_accepted()

        # Group 2
        test_ws_authz_nonexistent_conversation_rejected()
        test_ws_authz_non_participant_student_rejected()
        test_ws_authz_non_participant_recruiter_rejected()
        test_ws_authz_admin_non_participant_strictly_rejected()
        test_ws_authz_both_participants_connect_succeeds()

        # Group 3
        test_ws_manager_registers_on_connect()
        test_ws_manager_unregisters_on_disconnect()
        test_ws_multi_tab_same_user()
        test_ws_multi_tab_partial_disconnect()
        test_ws_get_active_users()
        test_ws_dead_socket_pruned_during_broadcast()

        # Group 4
        test_ws_msg_empty_body_rejected()
        test_ws_msg_whitespace_only_rejected()
        test_ws_msg_missing_body_rejected()
        test_ws_msg_non_string_body_rejected()
        test_ws_msg_oversized_body_rejected()
        test_ws_msg_malformed_json_handled()
        test_ws_msg_non_dict_json_handled()
        test_ws_msg_unsupported_event_type()
        test_ws_ping_pong_heartbeat()

        # Group 5
        test_ws_msg_persists_to_database()
        test_ws_sender_id_strictly_derived_from_jwt()
        test_ws_message_associates_correct_conversation()
        test_ws_database_consistency_with_http_list()

        # Group 6
        test_ws_realtime_broadcast_to_recipient()
        test_ws_realtime_broadcast_to_sender()
        test_ws_realtime_broadcast_to_multiple_tabs()
        test_ws_conversation_isolation()
        test_ws_offline_recipient_delivery()
        test_ws_http_send_broadcasts_to_active_ws()

        # Group 7
        test_ws_delivered_message_remains_unread()
        test_ws_mark_read_event_updates_database()
        test_ws_mark_read_event_broadcasts_receipt()
        test_ws_http_read_broadcasts_to_active_ws()

        # Group 8
        test_ws_notification_created_for_recipient()
        test_ws_no_notification_for_sender()
        test_ws_no_password_hash_leakage_in_ws()
        test_ws_repeated_connections_clean_state()
        test_ws_mark_single_message_read_http_broadcasts()

        print("\n=======================================================")
        print("ALL 48 WEBSOCKET MESSAGING TEST CASES PASSED SUCCESSFULLY!")
        print("=======================================================\n")
    finally:
        teardown_module()
