from datetime import datetime, timezone
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.job_invitation import InvitationStatus, JobInvitation
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER1_EMAIL = "inv_recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "inv_recruiter2@careerbridge.io"
STUDENT1_EMAIL = "inv_student1@careerbridge.io"
STUDENT2_EMAIL = "inv_student2@careerbridge.io"
INACTIVE_STUDENT_EMAIL = "inv_inactive_student@careerbridge.io"
TEST_PASSWORD = "SecurePassword123!"

DATA = {}


def setup_module():
    teardown_module()
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

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
        inactive_stu = User(
            email=INACTIVE_STUDENT_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=False,
            is_verified=True,
        )
        db.add_all([rec1, rec2, stu1, stu2, inactive_stu])
        db.commit()
        db.refresh(rec1)
        db.refresh(rec2)
        db.refresh(stu1)
        db.refresh(stu2)
        db.refresh(inactive_stu)

        rec_prof1 = RecruiterProfile(
            user_id=rec1.id,
            company_name="Apex Global Tech",
            contact_name="Sarah Connor",
        )
        rec_prof2 = RecruiterProfile(
            user_id=rec2.id,
            company_name="Quantum Byte Inc",
            contact_name="Miles Dyson",
        )
        stu_prof1 = StudentProfile(
            user_id=stu1.id,
            full_name="Elena Rostova",
            college="Georgia Tech",
            degree="B.S.",
            branch="Computer Science",
            graduation_year=2026,
            skills="C++, Distributed Systems, React",
        )
        stu_prof2 = StudentProfile(
            user_id=stu2.id,
            full_name="Marcus Vance",
            college="UC Berkeley",
            degree="M.S.",
            branch="Software Engineering",
            graduation_year=2027,
            skills="TypeScript, Node.js, Python",
        )
        db.add_all([rec_prof1, rec_prof2, stu_prof1, stu_prof2])
        db.commit()

        job1 = JobPosting(
            recruiter_id=rec1.id,
            title="Distributed Systems Engineer",
            description="Build high-scale distributed backends.",
            company_name="Apex Global Tech",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_remote=True,
            is_active=True,
        )
        job2 = JobPosting(
            recruiter_id=rec2.id,
            title="Cloud Infrastructure Lead",
            description="Design cloud systems.",
            company_name="Quantum Byte Inc",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_remote=True,
            is_active=True,
        )
        job_inactive = JobPosting(
            recruiter_id=rec1.id,
            title="Archived Role",
            description="No longer active.",
            company_name="Apex Global Tech",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_remote=False,
            is_active=False,
        )
        db.add_all([job1, job2, job_inactive])
        db.commit()
        db.refresh(job1)
        db.refresh(job2)
        db.refresh(job_inactive)

        DATA["rec1_id"] = rec1.id
        DATA["rec2_id"] = rec2.id
        DATA["stu1_id"] = stu1.id
        DATA["stu2_id"] = stu2.id
        DATA["inactive_stu_id"] = inactive_stu.id
        DATA["job1_id"] = job1.id
        DATA["job2_id"] = job2.id
        DATA["job_inactive_id"] = job_inactive.id


def teardown_module():
    emails = [
        RECRUITER1_EMAIL,
        RECRUITER2_EMAIL,
        STUDENT1_EMAIL,
        STUDENT2_EMAIL,
        INACTIVE_STUDENT_EMAIL,
    ]
    with SessionLocal() as db:
        users = list(db.scalars(select(User).where(User.email.in_(emails))).all())
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(
                delete(JobInvitation).where(
                    JobInvitation.recruiter_id.in_(user_ids)
                    | JobInvitation.student_id.in_(user_ids)
                )
            )
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


@pytest.fixture(scope="module", autouse=True)
def manage_test_data():
    setup_module()
    yield
    teardown_module()


def test_recruiter_can_create_invitation_and_notifies_student():
    token = create_access_token(DATA["rec1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "student_id": DATA["stu1_id"],
        "message": "We were impressed by your distributed systems project! Please apply.",
    }

    response = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["job_id"] == DATA["job1_id"]
    assert data["student_id"] == DATA["stu1_id"]
    assert data["recruiter_id"] == DATA["rec1_id"]
    assert data["status"] == "pending"
    assert data["message"] == payload["message"]
    assert data["job_posting"]["title"] == "Distributed Systems Engineer"
    assert data["job_posting"]["company_name"] == "Apex Global Tech"

    # Verify student received notification
    with SessionLocal() as db:
        notification = db.scalar(
            select(Notification).where(
                Notification.user_id == DATA["stu1_id"],
                Notification.notification_type == NotificationType.JOB_INVITATION_RECEIVED,
            )
        )
        assert notification is not None


def test_duplicate_pending_invitation_rejected_with_409():
    token = create_access_token(DATA["rec1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"student_id": DATA["stu1_id"], "message": "Duplicate invite"}
    response = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 409
    assert "already been sent" in response.json()["detail"]


def test_recruiter_cannot_invite_through_another_recruiter_job():
    token = create_access_token(DATA["rec2_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"student_id": DATA["stu1_id"], "message": "Unauthorized invite"}
    response = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 403


def test_cannot_invite_to_inactive_job():
    token = create_access_token(DATA["rec1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"student_id": DATA["stu2_id"], "message": "Inactive job invite"}
    response = client.post(
        f"/api/v1/jobs/{DATA['job_inactive_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 400


def test_student_cannot_create_invitations():
    token = create_access_token(DATA["stu1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"student_id": DATA["stu2_id"], "message": "Invalid"}
    response = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 403


def test_self_invitation_rejected():
    token = create_access_token(DATA["rec1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"student_id": DATA["rec1_id"], "message": "Self invite"}
    response = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 400


def test_cannot_invite_inactive_student():
    token = create_access_token(DATA["rec1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"student_id": DATA["inactive_stu_id"], "message": "Inactive student invite"}
    response = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 404


def test_student_can_list_own_invitations_and_not_others():
    token1 = create_access_token(DATA["stu1_id"])
    resp1 = client.get("/api/v1/student/invitations", headers={"Authorization": f"Bearer {token1}"})
    assert resp1.status_code == 200
    items1 = resp1.json()
    assert len(items1) >= 1
    assert items1[0]["student_id"] == DATA["stu1_id"]

    token2 = create_access_token(DATA["stu2_id"])
    resp2 = client.get("/api/v1/student/invitations", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.status_code == 200
    items2 = resp2.json()
    # Student 2 has not received invitations yet
    assert not any(item["student_id"] == DATA["stu1_id"] for item in items2)


def test_recruiter_can_list_job_invitations():
    token = create_access_token(DATA["rec1_id"])
    resp = client.get(f"/api/v1/jobs/{DATA['job1_id']}/invitations", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["job_id"] == DATA["job1_id"]


def test_student_can_accept_invitation_and_notifies_recruiter():
    # First get student 1's pending invitation
    token = create_access_token(DATA["stu1_id"])
    list_resp = client.get("/api/v1/student/invitations", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.status_code == 200
    invitations = list_resp.json()
    assert len(invitations) >= 1
    inv_id = invitations[0]["id"]

    response = client.patch(
        f"/api/v1/invitations/{inv_id}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["responded_at"] is not None

    # Verify recruiter received notification
    with SessionLocal() as db:
        notification = db.scalar(
            select(Notification).where(
                Notification.user_id == DATA["rec1_id"],
                Notification.notification_type == NotificationType.JOB_INVITATION_RESPONDED,
            )
        )
        assert notification is not None


def test_cannot_re_respond_to_already_accepted_invitation():
    token = create_access_token(DATA["stu1_id"])
    list_resp = client.get("/api/v1/student/invitations", headers={"Authorization": f"Bearer {token}"})
    inv_id = list_resp.json()[0]["id"]

    response = client.patch(
        f"/api/v1/invitations/{inv_id}",
        json={"status": "declined"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "already been accepted" in response.json()["detail"]


def test_student_can_decline_invitation():
    # Create another invitation for student 2
    token_rec = create_access_token(DATA["rec2_id"])
    create_resp = client.post(
        f"/api/v1/jobs/{DATA['job2_id']}/invitations",
        json={"student_id": DATA["stu2_id"], "message": "Join our cloud team"},
        headers={"Authorization": f"Bearer {token_rec}"},
    )
    assert create_resp.status_code == 201
    inv2_id = create_resp.json()["id"]

    # Student 2 declines
    token_stu2 = create_access_token(DATA["stu2_id"])
    response = client.patch(
        f"/api/v1/invitations/{inv2_id}",
        json={"status": "declined"},
        headers={"Authorization": f"Bearer {token_stu2}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "declined"


def test_unauthorized_student_cannot_respond_to_another_students_invitation():
    # Recruiter 1 invites student 2
    token_rec = create_access_token(DATA["rec1_id"])
    create_resp = client.post(
        f"/api/v1/jobs/{DATA['job1_id']}/invitations",
        json={"student_id": DATA["stu2_id"], "message": "Invite for student 2"},
        headers={"Authorization": f"Bearer {token_rec}"},
    )
    assert create_resp.status_code == 201
    inv_id = create_resp.json()["id"]

    # Student 1 attempts to respond to student 2's invitation
    token_stu1 = create_access_token(DATA["stu1_id"])
    response = client.patch(
        f"/api/v1/invitations/{inv_id}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {token_stu1}"},
    )
    assert response.status_code == 403


def test_recruiter_can_search_candidates_directory():
    token = create_access_token(DATA["rec1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/recruiter/candidates?q=Elena", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] >= 1
    assert any(item["full_name"] == "Elena Rostova" for item in data["items"])
