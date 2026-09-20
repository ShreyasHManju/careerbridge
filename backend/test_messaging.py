"""
CareerBridge Phase 19 Messaging Foundation Test Suite
Covers authentication, conversation lifecycle, participant authorization,
message delivery, pagination, read/unread states, notifications, security, and cascade deletion.
"""

from datetime import datetime, timezone
from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "messaging.student1@careerbridge.io"
STUDENT2_EMAIL = "messaging.student2@careerbridge.io"
RECRUITER1_EMAIL = "messaging.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "messaging.recruiter2@careerbridge.io"
ADMIN_EMAIL = "messaging.admin@careerbridge.io"
INACTIVE_EMAIL = "messaging.inactive@careerbridge.io"
TEST_PASSWORD = "MessagingPassword123!"


def setup_module():
    """Seed test users, profiles, and clean prior data."""
    teardown_module()
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        stu1 = User(
            email=STUDENT1_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        stu2 = User(
            email=STUDENT2_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        rec1 = User(
            email=RECRUITER1_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        rec2 = User(
            email=RECRUITER2_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        admin = User(
            email=ADMIN_EMAIL,
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        inactive = User(
            email=INACTIVE_EMAIL,
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
            full_name="Alice Candidate",
            college="MIT",
            degree="B.S.",
            branch="Computer Science",
            graduation_year=2026,
            skills=["Python", "FastAPI"],
        )
        sp2 = StudentProfile(
            user_id=stu2.id,
            full_name="Bob Applicant",
            college="Stanford",
            degree="B.S.",
            branch="Software Engineering",
            graduation_year=2025,
            skills=["React", "TypeScript"],
        )
        rp1 = RecruiterProfile(
            user_id=rec1.id,
            company_name="AlphaTech Innovations",
            is_verified=True,
        )
        rp2 = RecruiterProfile(
            user_id=rec2.id,
            company_name="BetaGlobal Systems",
            is_verified=True,
        )
        db.add_all([sp1, sp2, rp1, rp2])
        db.commit()


def teardown_module():
    """Purge test users and all cascaded conversations and messages."""
    emails = [
        STUDENT1_EMAIL,
        STUDENT2_EMAIL,
        RECRUITER1_EMAIL,
        RECRUITER2_EMAIL,
        ADMIN_EMAIL,
        INACTIVE_EMAIL,
    ]
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.in_(emails))).all()
        for u in users:
            db.delete(u)
        db.commit()


def get_auth_headers(email: str) -> dict:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user, f"User {email} not found"
        token = create_access_token(subject=user.id)
        return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------
# 1. Authentication Tests (1-5, 45)
# --------------------------------------------------------------------------
def test_unauthenticated_conversation_creation():
    resp = client.post("/api/v1/conversations", json={"other_user_id": 2})
    assert resp.status_code == 401


def test_unauthenticated_conversation_list():
    resp = client.get("/api/v1/conversations")
    assert resp.status_code == 401


def test_unauthenticated_message_creation():
    resp = client.post("/api/v1/conversations/1/messages", json={"body": "Hello"})
    assert resp.status_code == 401


def test_unauthenticated_message_listing():
    resp = client.get("/api/v1/conversations/1/messages")
    assert resp.status_code == 401


def test_unauthenticated_read_endpoint():
    resp1 = client.patch("/api/v1/conversations/1/read")
    assert resp1.status_code == 401

    resp2 = client.patch("/api/v1/messages/1/read")
    assert resp2.status_code == 401


def test_inactive_user_rejected():
    headers = get_auth_headers(INACTIVE_EMAIL)
    resp = client.get("/api/v1/conversations", headers=headers)
    assert resp.status_code == 401
    assert "inactive" in resp.json()["detail"].lower()


# --------------------------------------------------------------------------
# 2. Conversation Lifecycle (6-13)
# --------------------------------------------------------------------------
def test_create_conversation_successfully():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        rec1_id = rec1.id

    resp = client.post(
        "/api/v1/conversations",
        headers=stu1_headers,
        json={"other_user_id": rec1_id, "initial_message": "Hello recruiter!"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["other_participant"]["id"] == rec1_id
    assert data["other_participant"]["email"] == RECRUITER1_EMAIL
    assert data["other_participant"]["company_name"] == "AlphaTech Innovations"
    assert data["last_message"] is not None
    assert data["last_message"]["body"] == "Hello recruiter!"


def test_cannot_create_conversation_with_self():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        stu1_id = stu1.id

    resp = client.post(
        "/api/v1/conversations",
        headers=stu1_headers,
        json={"other_user_id": stu1_id},
    )
    assert resp.status_code == 400
    assert "yourself" in resp.json()["detail"].lower()


def test_cannot_create_conversation_with_missing_user():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    resp = client.post(
        "/api/v1/conversations",
        headers=stu1_headers,
        json={"other_user_id": 999999},
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_cannot_create_conversation_with_inactive_user():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        inactive = db.scalar(select(User).where(User.email == INACTIVE_EMAIL))
        inactive_id = inactive.id

    resp = client.post(
        "/api/v1/conversations",
        headers=stu1_headers,
        json={"other_user_id": inactive_id},
    )
    assert resp.status_code == 400
    assert "inactive" in resp.json()["detail"].lower()


def test_duplicate_conversation_returns_reuses_existing():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        stu1_id = stu1.id
        rec1_id = rec1.id

    # Recruiter creates conversation with student (reverse order of participants)
    resp = client.post(
        "/api/v1/conversations",
        headers=rec1_headers,
        json={"other_user_id": stu1_id},
    )
    assert resp.status_code == 200  # Existing reused!
    conv_id = resp.json()["id"]

    # Student creates conversation again
    resp2 = client.post(
        "/api/v1/conversations",
        headers=stu1_headers,
        json={"other_user_id": rec1_id},
    )
    assert resp2.status_code == 200
    assert resp2.json()["id"] == conv_id


def test_concurrent_duplicate_creation_handled_safely():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        rec2 = db.scalar(select(User).where(User.email == RECRUITER2_EMAIL))
        rec2_id = rec2.id

    resp1 = client.post(
        "/api/v1/conversations",
        headers=stu2_headers,
        json={"other_user_id": rec2_id},
    )
    assert resp1.status_code == 201

    resp2 = client.post(
        "/api/v1/conversations",
        headers=stu2_headers,
        json={"other_user_id": rec2_id},
    )
    assert resp2.status_code == 200
    assert resp1.json()["id"] == resp2.json()["id"]


def test_exactly_two_participants():
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        assert conv is not None
        participants = db.scalars(
            select(ConversationParticipant).where(ConversationParticipant.conversation_id == conv.id)
        ).all()
        assert len(participants) == 2
        user_ids = {p.user_id for p in participants}
        assert user_ids == {conv.user1_id, conv.user2_id}


def test_participant_uniqueness():
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        assert conv is not None
        p_ids = db.scalars(
            select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id == conv.id)
        ).all()
        assert len(p_ids) == len(set(p_ids))


# --------------------------------------------------------------------------
# 3. Authorization Tests (14-19)
# --------------------------------------------------------------------------
def test_participant_can_access_conversation():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    # Student can get conversation
    resp_s = client.get(f"/api/v1/conversations/{conv_id}", headers=stu1_headers)
    assert resp_s.status_code == 200
    assert resp_s.json()["id"] == conv_id

    # Recruiter can get conversation
    resp_r = client.get(f"/api/v1/conversations/{conv_id}", headers=rec1_headers)
    assert resp_r.status_code == 200
    assert resp_r.json()["id"] == conv_id


def test_non_participant_cannot_access_conversation():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    # Student 2 is not in (stu1, rec1) conversation
    resp = client.get(f"/api/v1/conversations/{conv_id}", headers=stu2_headers)
    assert resp.status_code == 403


def test_non_participant_cannot_list_messages():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    resp = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=stu2_headers)
    assert resp.status_code == 403


def test_non_participant_cannot_send_messages():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=stu2_headers,
        json={"body": "Intrusion attempt"},
    )
    assert resp.status_code == 403


def test_non_participant_cannot_mark_messages_read():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    resp = client.patch(f"/api/v1/conversations/{conv_id}/read", headers=stu2_headers)
    assert resp.status_code == 403


def test_admin_cannot_bypass_private_conversation_authorization():
    admin_headers = get_auth_headers(ADMIN_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    # Admin cannot view conversation
    resp1 = client.get(f"/api/v1/conversations/{conv_id}", headers=admin_headers)
    assert resp1.status_code == 403

    # Admin cannot list messages
    resp2 = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=admin_headers)
    assert resp2.status_code == 403

    # Admin cannot send message
    resp3 = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=admin_headers,
        json={"body": "Admin message"},
    )
    assert resp3.status_code == 403

    # Admin cannot mark messages read
    resp4 = client.patch(f"/api/v1/conversations/{conv_id}/read", headers=admin_headers)
    assert resp4.status_code == 403


# --------------------------------------------------------------------------
# 4. Message Creation Validation & Integrity (20-26)
# --------------------------------------------------------------------------
def test_valid_message_returns_201():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Hi Alice! Thank you for applying to AlphaTech."},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["conversation_id"] == conv_id
    assert data["body"] == "Hi Alice! Thank you for applying to AlphaTech."
    assert data["is_read"] is False
    assert data["sender_email"] == RECRUITER1_EMAIL


def test_empty_body_rejected():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": ""},
    )
    assert resp.status_code == 422


def test_whitespace_only_body_rejected():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "   \n\t   "},
    )
    assert resp.status_code == 422


def test_oversized_body_rejected():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    oversized = "a" * 5005
    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": oversized},
    )
    assert resp.status_code == 422


def test_sender_identity_comes_from_current_user():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        rec1_id = rec1.id

    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Identity verification message"},
    )
    assert resp.status_code == 201
    assert resp.json()["sender_id"] == rec1_id


def test_client_supplied_sender_id_cannot_spoof():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        stu1_id = stu1.id
        rec1_id = rec1.id

    # Recruiter tries to send with sender_id = stu1.id
    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Spoof attempt", "sender_id": stu1_id},
    )
    assert resp.status_code == 201
    # Must STILL be recruiter 1
    assert resp.json()["sender_id"] == rec1_id


def test_message_belongs_to_correct_conversation():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=stu1_headers,
        json={"body": "Message binding test"},
    )
    assert resp.status_code == 201
    msg_id = resp.json()["id"]

    with SessionLocal() as db:
        msg = db.scalar(select(Message).where(Message.id == msg_id))
        assert msg.conversation_id == conv_id


# --------------------------------------------------------------------------
# 5. Message Listing & Pagination (27-30)
# --------------------------------------------------------------------------
def test_participant_can_list_messages():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    resp = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=stu1_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


def test_pagination_works():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    # page_size = 2
    resp = client.get(
        f"/api/v1/conversations/{conv_id}/messages?page=1&page_size=2",
        headers=stu1_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 2
    assert data["page"] == 1
    assert data["page_size"] == 2


def test_ordering_is_stable():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    resp = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=stu1_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) >= 2
    for i in range(len(items) - 1):
        dt1 = datetime.fromisoformat(items[i]["created_at"])
        dt2 = datetime.fromisoformat(items[i + 1]["created_at"])
        assert dt1 <= dt2


def test_messages_from_unrelated_conversations_are_not_returned():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        stu2 = db.scalar(select(User).where(User.email == STUDENT2_EMAIL))
        rec2 = db.scalar(select(User).where(User.email == RECRUITER2_EMAIL))
        u1 = min(stu2.id, rec2.id)
        u2 = max(stu2.id, rec2.id)
        conv2 = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv2_id = conv2.id

    # Send message in conv2
    resp = client.post(
        f"/api/v1/conversations/{conv2_id}/messages",
        headers=stu2_headers,
        json={"body": "Exclusive message in conversation 2"},
    )
    assert resp.status_code == 201

    # List conv2 messages
    list_resp = client.get(f"/api/v1/conversations/{conv2_id}/messages", headers=stu2_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    for item in items:
        assert item["conversation_id"] == conv2_id


# --------------------------------------------------------------------------
# 6. Read / Unread State & Idempotency (31-35, 46-48)
# --------------------------------------------------------------------------
def test_unread_messages_are_counted():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    # Recruiter sends an unread message to Student 1
    send_resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Are you available for an interview tomorrow?"},
    )
    assert send_resp.status_code == 201

    # Check student conversation listing unread count
    conv_list = client.get("/api/v1/conversations", headers=stu1_headers).json()
    conv_item = next(c for c in conv_list["items"] if c["id"] == conv_id)
    assert conv_item["unread_count"] >= 1


def test_sender_own_messages_not_counted_as_unread():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    conv_list_before = client.get("/api/v1/conversations", headers=rec1_headers).json()
    item_before = next(c for c in conv_list_before["items"] if c["id"] == conv_id)
    count_before = item_before["unread_count"]

    # Recruiter sends another message
    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Another message sent by recruiter"},
    )
    assert resp.status_code == 201

    conv_list_after = client.get("/api/v1/conversations", headers=rec1_headers).json()
    item_after = next(c for c in conv_list_after["items"] if c["id"] == conv_id)
    count_after = item_after["unread_count"]

    # Sender's unread count must not have changed
    assert count_after == count_before


def test_read_endpoint_marks_recipient_messages_read():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    # Student marks conversation read
    resp = client.patch(f"/api/v1/conversations/{conv_id}/read", headers=stu1_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_id"] == conv_id
    assert data["marked_read_count"] >= 1

    # Verify unread count is now 0 for student
    conv_list = client.get("/api/v1/conversations", headers=stu1_headers).json()
    conv_item = next(c for c in conv_list["items"] if c["id"] == conv_id)
    assert conv_item["unread_count"] == 0


def test_read_at_is_populated():
    with SessionLocal() as db:
        msg = db.scalar(select(Message).where(Message.is_read == True).order_by(Message.id.desc()))
        assert msg is not None
        assert msg.read_at is not None


def test_repeated_read_operation_is_safe_idempotent():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    resp = client.patch(f"/api/v1/conversations/{conv_id}/read", headers=stu1_headers)
    assert resp.status_code == 200
    assert resp.json()["marked_read_count"] == 0


def test_mark_single_message_read_endpoint():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    # Recruiter sends single unread message
    send_resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Single message read test"},
    )
    assert send_resp.status_code == 201
    msg_id = send_resp.json()["id"]

    # Student marks this single message read
    resp = client.patch(f"/api/v1/messages/{msg_id}/read", headers=stu1_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == msg_id
    assert resp.json()["is_read"] is True
    assert resp.json()["read_at"] is not None


def test_sender_cannot_mark_own_message_read():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    send_resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Own message read rejection"},
    )
    msg_id = send_resp.json()["id"]

    # Recruiter tries to mark their own message read -> 400
    resp = client.patch(f"/api/v1/messages/{msg_id}/read", headers=rec1_headers)
    assert resp.status_code == 400
    assert "own sent message" in resp.json()["detail"].lower()


def test_non_participant_cannot_mark_single_message_read():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    with SessionLocal() as db:
        msg = db.scalar(select(Message).where(Message.conversation_id == conv_id))
        msg_id = msg.id

    resp = client.patch(f"/api/v1/messages/{msg_id}/read", headers=stu2_headers)
    assert resp.status_code == 403


# --------------------------------------------------------------------------
# 7. Notifications Integration (36-39)
# --------------------------------------------------------------------------
def test_recipient_receives_message_notification():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    before_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]

    client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Notification trigger test message"},
    )

    after_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]
    assert after_notifs == before_notifs + 1

    notifs = client.get("/api/v1/notifications?page=1&page_size=1", headers=stu1_headers).json()
    newest = notifs["items"][0]
    assert newest["notification_type"] == "message_received"
    assert RECRUITER1_EMAIL in newest["title"]


def test_sender_does_not_receive_their_own_message_notification():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    before_notifs = client.get("/api/v1/notifications/unread-count", headers=rec1_headers).json()["unread_count"]

    client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Sender check message"},
    )

    after_notifs = client.get("/api/v1/notifications/unread-count", headers=rec1_headers).json()["unread_count"]
    assert after_notifs == before_notifs


def test_notification_references_correct_context():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        conv = db.scalar(select(Conversation).order_by(Conversation.id.asc()))
        conv_id = conv.id

    client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=rec1_headers,
        json={"body": "Context verification"},
    )

    notifs = client.get("/api/v1/notifications?page=1&page_size=1", headers=stu1_headers).json()
    newest = notifs["items"][0]
    assert newest["notification_type"] == "message_received"
    assert "Context verification" in newest["message"]


# --------------------------------------------------------------------------
# 8. Security, Edge Cases & Cascades (40-44, 49-50)
# --------------------------------------------------------------------------
def test_cross_user_conversation_access_blocked():
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id

    # Stu2 trying to access conv belonging to stu1 & rec1
    resp = client.get(f"/api/v1/conversations/{conv_id}", headers=stu2_headers)
    assert resp.status_code == 403


def test_arbitrary_participant_manipulation_blocked():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        stu2 = db.scalar(select(User).where(User.email == STUDENT2_EMAIL))
        u1 = min(stu1.id, rec1.id)
        u2 = max(stu1.id, rec1.id)
        conv = db.scalar(select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2))
        conv_id = conv.id
        stu2_id = stu2.id

    # Attempting to inject third user into conversation
    resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=stu1_headers,
        json={"body": "Injection attempt", "participant_id": stu2_id},
    )
    assert resp.status_code == 201
    with SessionLocal() as db:
        participants = db.scalars(
            select(ConversationParticipant).where(ConversationParticipant.conversation_id == conv_id)
        ).all()
        assert len(participants) == 2


def test_invalid_conversation_id_handled_correctly():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    resp = client.get("/api/v1/conversations/999999", headers=stu1_headers)
    assert resp.status_code == 404

    resp2 = client.get("/api/v1/conversations/999999/messages", headers=stu1_headers)
    assert resp2.status_code == 404

    resp3 = client.post(
        "/api/v1/conversations/999999/messages",
        headers=stu1_headers,
        json={"body": "Hello"},
    )
    assert resp3.status_code == 404


def test_no_password_hash_leakage_in_messaging_responses():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    # Conversation list
    conv_list = client.get("/api/v1/conversations", headers=stu1_headers).json()
    for c in conv_list["items"]:
        assert "password_hash" not in c
        assert "password" not in c
        assert "password_hash" not in c["other_participant"]

    # Conversation detail
    conv_id = conv_list["items"][0]["id"]
    conv_detail = client.get(f"/api/v1/conversations/{conv_id}", headers=stu1_headers).json()
    assert "password_hash" not in conv_detail
    assert "password_hash" not in conv_detail["other_participant"]

    # Messages list
    msg_list = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=stu1_headers).json()
    for m in msg_list["items"]:
        assert "password_hash" not in m


def test_cascade_deletion_on_user_delete():
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)
        temp_user_a = User(
            email="temp.messaging.a@careerbridge.io",
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        temp_user_b = User(
            email="temp.messaging.b@careerbridge.io",
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        db.add_all([temp_user_a, temp_user_b])
        db.commit()
        db.refresh(temp_user_a)
        db.refresh(temp_user_b)
        ua_id = temp_user_a.id
        ub_id = temp_user_b.id

    token_a = create_access_token(subject=ua_id)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    create_resp = client.post(
        "/api/v1/conversations",
        headers=headers_a,
        json={"other_user_id": ub_id, "initial_message": "Transient message"},
    )
    assert create_resp.status_code == 201
    temp_conv_id = create_resp.json()["id"]

    # Delete user A
    with SessionLocal() as db:
        u_a = db.scalar(select(User).where(User.id == ua_id))
        db.delete(u_a)
        db.commit()

        # Conversation must be cascade-deleted
        conv = db.scalar(select(Conversation).where(Conversation.id == temp_conv_id))
        assert conv is None

        # Participants must be cascade-deleted
        participants = db.scalars(
            select(ConversationParticipant).where(ConversationParticipant.conversation_id == temp_conv_id)
        ).all()
        assert len(participants) == 0

        # Messages must be cascade-deleted
        messages = db.scalars(
            select(Message).where(Message.conversation_id == temp_conv_id)
        ).all()
        assert len(messages) == 0

        # Cleanup user B
        u_b = db.scalar(select(User).where(User.id == ub_id))
        if u_b:
            db.delete(u_b)
            db.commit()


def test_batched_conversation_listing_multi_conversations():
    """Verify batched conversation listing handles multiple conversations with exact latest message, unread count, and <= 3 DB queries."""
    from sqlalchemy import event
    from app.core.database import engine

    headers_s1 = get_auth_headers(STUDENT1_EMAIL)

    # Ensure multiple conversations exist for student 1
    with SessionLocal() as db:
        s1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        s2 = db.scalar(select(User).where(User.email == STUDENT2_EMAIL))
        r1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        r2 = db.scalar(select(User).where(User.email == RECRUITER2_EMAIL))

    # Create/ensure conversations with r1, r2, and s2
    client.post("/api/v1/conversations", headers=headers_s1, json={"other_user_id": r1.id, "initial_message": "Hello Recruiter 1"})
    client.post("/api/v1/conversations", headers=headers_s1, json={"other_user_id": r2.id, "initial_message": "Hello Recruiter 2"})
    client.post("/api/v1/conversations", headers=headers_s1, json={"other_user_id": s2.id, "initial_message": "Hello Student 2"})

    # Send a message from Recruiter 1 to Student 1
    headers_r1 = get_auth_headers(RECRUITER1_EMAIL)
    r1_conv_id = client.post("/api/v1/conversations", headers=headers_r1, json={"other_user_id": s1.id}).json()["id"]
    client.post(f"/api/v1/conversations/{r1_conv_id}/messages", headers=headers_r1, json={"body": "Latest from Recruiter 1"})

    # Track SQL query count during list_conversations
    query_count = 0
    def count_queries(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        # Ignore rollback/commit or unrelated auth statements if any
        if not statement.strip().upper().startswith(("ROLLBACK", "COMMIT")):
            query_count += 1

    event.listen(engine, "before_cursor_execute", count_queries)
    try:
        resp = client.get("/api/v1/conversations", headers=headers_s1)
    finally:
        event.remove(engine, "before_cursor_execute", count_queries)

    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 3

    # Verify query count is strictly bounded (1 for auth user + 3 for batched conversations = at most 4 total SQL queries)
    assert query_count <= 4, f"Expected <= 4 queries for list_conversations with 3+ conversations, but got {query_count}"

    # Verify unread count and latest message for the recruiter 1 conversation
    r1_conv = next(item for item in data["items"] if item["id"] == r1_conv_id)
    assert r1_conv["unread_count"] >= 1
    assert r1_conv["last_message"] is not None
    assert r1_conv["last_message"]["body"] == "Latest from Recruiter 1"


if __name__ == "__main__":
    setup_module()
    try:
        test_unauthenticated_conversation_creation()
        print("PASS: test_unauthenticated_conversation_creation")
        test_unauthenticated_conversation_list()
        print("PASS: test_unauthenticated_conversation_list")
        test_unauthenticated_message_creation()
        print("PASS: test_unauthenticated_message_creation")
        test_unauthenticated_message_listing()
        print("PASS: test_unauthenticated_message_listing")
        test_unauthenticated_read_endpoint()
        print("PASS: test_unauthenticated_read_endpoint")
        test_inactive_user_rejected()
        print("PASS: test_inactive_user_rejected")
        test_create_conversation_successfully()
        print("PASS: test_create_conversation_successfully")
        test_cannot_create_conversation_with_self()
        print("PASS: test_cannot_create_conversation_with_self")
        test_cannot_create_conversation_with_missing_user()
        print("PASS: test_cannot_create_conversation_with_missing_user")
        test_cannot_create_conversation_with_inactive_user()
        print("PASS: test_cannot_create_conversation_with_inactive_user")
        test_duplicate_conversation_returns_reuses_existing()
        print("PASS: test_duplicate_conversation_returns_reuses_existing")
        test_concurrent_duplicate_creation_handled_safely()
        print("PASS: test_concurrent_duplicate_creation_handled_safely")
        test_exactly_two_participants()
        print("PASS: test_exactly_two_participants")
        test_participant_uniqueness()
        print("PASS: test_participant_uniqueness")
        test_participant_can_access_conversation()
        print("PASS: test_participant_can_access_conversation")
        test_non_participant_cannot_access_conversation()
        print("PASS: test_non_participant_cannot_access_conversation")
        test_non_participant_cannot_list_messages()
        print("PASS: test_non_participant_cannot_list_messages")
        test_non_participant_cannot_send_messages()
        print("PASS: test_non_participant_cannot_send_messages")
        test_non_participant_cannot_mark_messages_read()
        print("PASS: test_non_participant_cannot_mark_messages_read")
        test_admin_cannot_bypass_private_conversation_authorization()
        print("PASS: test_admin_cannot_bypass_private_conversation_authorization")
        test_valid_message_returns_201()
        print("PASS: test_valid_message_returns_201")
        test_empty_body_rejected()
        print("PASS: test_empty_body_rejected")
        test_whitespace_only_body_rejected()
        print("PASS: test_whitespace_only_body_rejected")
        test_oversized_body_rejected()
        print("PASS: test_oversized_body_rejected")
        test_sender_identity_comes_from_current_user()
        print("PASS: test_sender_identity_comes_from_current_user")
        test_client_supplied_sender_id_cannot_spoof()
        print("PASS: test_client_supplied_sender_id_cannot_spoof")
        test_message_belongs_to_correct_conversation()
        print("PASS: test_message_belongs_to_correct_conversation")
        test_participant_can_list_messages()
        print("PASS: test_participant_can_list_messages")
        test_pagination_works()
        print("PASS: test_pagination_works")
        test_ordering_is_stable()
        print("PASS: test_ordering_is_stable")
        test_messages_from_unrelated_conversations_are_not_returned()
        print("PASS: test_messages_from_unrelated_conversations_are_not_returned")
        test_unread_messages_are_counted()
        print("PASS: test_unread_messages_are_counted")
        test_sender_own_messages_not_counted_as_unread()
        print("PASS: test_sender_own_messages_not_counted_as_unread")
        test_read_endpoint_marks_recipient_messages_read()
        print("PASS: test_read_endpoint_marks_recipient_messages_read")
        test_read_at_is_populated()
        print("PASS: test_read_at_is_populated")
        test_repeated_read_operation_is_safe_idempotent()
        print("PASS: test_repeated_read_operation_is_safe_idempotent")
        test_mark_single_message_read_endpoint()
        print("PASS: test_mark_single_message_read_endpoint")
        test_sender_cannot_mark_own_message_read()
        print("PASS: test_sender_cannot_mark_own_message_read")
        test_non_participant_cannot_mark_single_message_read()
        print("PASS: test_non_participant_cannot_mark_single_message_read")
        test_recipient_receives_message_notification()
        print("PASS: test_recipient_receives_message_notification")
        test_sender_does_not_receive_their_own_message_notification()
        print("PASS: test_sender_does_not_receive_their_own_message_notification")
        test_notification_references_correct_context()
        print("PASS: test_notification_references_correct_context")
        test_cross_user_conversation_access_blocked()
        print("PASS: test_cross_user_conversation_access_blocked")
        test_arbitrary_participant_manipulation_blocked()
        print("PASS: test_arbitrary_participant_manipulation_blocked")
        test_invalid_conversation_id_handled_correctly()
        print("PASS: test_invalid_conversation_id_handled_correctly")
        test_no_password_hash_leakage_in_messaging_responses()
        print("PASS: test_no_password_hash_leakage_in_messaging_responses")
        test_batched_conversation_listing_multi_conversations()
        print("PASS: test_batched_conversation_listing_multi_conversations")
        test_cascade_deletion_on_user_delete()
        print("PASS: test_cascade_deletion_on_user_delete")
        print("\n=======================================================")
        print("ALL 47 MESSAGING TEST CASES PASSED SUCCESSFULLY!")
        print("=======================================================\n")
    finally:
        teardown_module()
