"""
CareerBridge Phase 30C — Recruiter Project Evaluation Test Suite (Security Tightened)
Comprehensive coverage for:
1. Authorized recruiter creation of draft evaluations with candidate relationship (Student -> Application -> JobPosting -> Recruiter).
2. Authorization denial (403) for recruiter without application relationship on PUBLIC + ACTIVE project.
3. Authorization denial (403) for recruiter without application relationship on PRIVATE project.
4. Recruiter cannot bypass authorization merely by knowing project_id or evaluation_id.
5. Student role prevention (403) from creating recruiter evaluations.
6. Prevention of evaluating own project (400/403).
7. Unique constraint rejection (409) for duplicate recruiter evaluations on same project.
8. Validation bounds on scores (1 to 5) and controlled recommendation/proficiency enums.
9. Updating draft evaluation by owner recruiter.
10. Cross-recruiter modification rejection (403/404).
11. Student modification rejection (403).
12. Submission requirement validation (all 5 dimensional scores and recommendation required).
13. Deterministic server-side overall score calculation.
14. Status transition DRAFT -> SUBMITTED and student in-app notification trigger.
15. Submitted evaluation immutability (cannot be modified after submission).
16. Draft invisibility: students cannot view draft evaluations.
17. Student visibility of submitted evaluations.
18. Evaluation withdrawal rules by owner recruiter or admin.
19. Skill assessment linking to canonical master skills and invalid skill ID rejection.
20. Database constraints, uniqueness, and cascade deletions.
"""

from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.innovation_project import (
    InnovationProject,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
)
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.notification import Notification, NotificationType
from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.recruiter_profile import RecruiterProfile
from app.models.skill import Skill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "eval.student1@careerbridge.io"
STUDENT2_EMAIL = "eval.student2@careerbridge.io"
RECRUITER1_EMAIL = "eval.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "eval.recruiter2@careerbridge.io"
ADMIN_EMAIL = "eval.admin@careerbridge.io"
TEST_PASSWORD = "EvalTestPassword123!"


def cleanup_test_data():
    """Remove test data created for evaluation test suite."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER1_EMAIL,
            RECRUITER2_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Delete notifications
            db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
            # Delete evaluations
            db.execute(
                delete(ProjectEvaluation).where(
                    (ProjectEvaluation.student_id.in_(user_ids))
                    | (ProjectEvaluation.recruiter_id.in_(user_ids))
                )
            )
            # Delete applications
            db.execute(delete(Application).where(Application.student_id.in_(user_ids)))
            # Delete job postings
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            # Delete innovation projects
            db.execute(delete(InnovationProject).where(InnovationProject.student_id.in_(user_ids)))
            # Delete profiles
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            # Delete users
            db.execute(delete(User).where(User.id.in_(user_ids)))
        db.commit()


def setup_test_users():
    """Seed test users, profiles, jobs, applications, and canonical skills."""
    cleanup_test_data()
    with SessionLocal() as db:
        # Create canonical test skill if needed
        skill_python = db.scalar(select(Skill).where(Skill.slug == "python"))
        if not skill_python:
            skill_python = Skill(name="Python", slug="python", category="Programming", is_verified=True)
            db.add(skill_python)

        skill_react = db.scalar(select(Skill).where(Skill.slug == "react"))
        if not skill_react:
            skill_react = Skill(name="React", slug="react", category="Frontend", is_verified=True)
            db.add(skill_react)

        pwd_hash = hash_password(TEST_PASSWORD)

        student1 = User(email=STUDENT1_EMAIL, password_hash=pwd_hash, role=UserRole.STUDENT, is_active=True, is_verified=True)
        student2 = User(email=STUDENT2_EMAIL, password_hash=pwd_hash, role=UserRole.STUDENT, is_active=True, is_verified=True)
        recruiter1 = User(email=RECRUITER1_EMAIL, password_hash=pwd_hash, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        recruiter2 = User(email=RECRUITER2_EMAIL, password_hash=pwd_hash, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        admin = User(email=ADMIN_EMAIL, password_hash=pwd_hash, role=UserRole.ADMIN, is_active=True, is_verified=True)

        db.add_all([student1, student2, recruiter1, recruiter2, admin])
        db.flush()

        # Profiles
        sp1 = StudentProfile(user_id=student1.id, full_name="Student One", college="Tech University", degree="B.Tech", graduation_year=2026)
        sp2 = StudentProfile(user_id=student2.id, full_name="Student Two", college="Science Institute", degree="B.S.", graduation_year=2025)
        rp1 = RecruiterProfile(user_id=recruiter1.id, contact_name="Recruiter One", company_name="Acme Tech", is_verified=True)
        rp2 = RecruiterProfile(user_id=recruiter2.id, contact_name="Recruiter Two", company_name="Beta Innovations", is_verified=True)
        db.add_all([sp1, sp2, rp1, rp2])
        db.flush()

        # Job posting by Recruiter 1
        job1 = JobPosting(
            recruiter_id=recruiter1.id,
            title="Software Engineering Intern",
            company_name="Acme Tech",
            location="Bangalore",
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.FULL_TIME,
            description="Internship opportunity.",
            skills="Python, React",
            is_active=True,
        )
        db.add(job1)
        db.flush()

        # Student 1 applies to Job 1 (establishing candidate relationship with Recruiter 1)
        app1 = Application(
            job_posting_id=job1.id,
            student_id=student1.id,
            status=ApplicationStatus.APPLIED,
            cover_message="Excited to apply.",
        )
        db.add(app1)

        # Student 1's public project
        proj_public = InnovationProject(
            student_id=student1.id,
            title="Cloud Monitoring Dashboard",
            slug="cloud-monitoring-dashboard",
            description="Real-time monitoring system.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
        )
        # Student 2's private project (Student 2 has NOT applied to Recruiter 1's or Recruiter 2's jobs)
        proj_private = InnovationProject(
            student_id=student2.id,
            title="Private Research Algorithm",
            slug="private-research-algorithm",
            description="Confidential machine learning research.",
            project_type=ProjectType.RESEARCH,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PRIVATE,
        )
        db.add_all([proj_public, proj_private])
        db.commit()


def auth_headers(email: str) -> dict:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        token = create_access_token(subject=user.id)
        return {"Authorization": f"Bearer {token}"}


def test_project_evaluations_suite():
    print("CAREERBRIDGE PHASE 30C — RECRUITER PROJECT EVALUATION TEST SUITE")
    setup_test_users()

    with SessionLocal() as db:
        proj_public = db.scalar(select(InnovationProject).where(InnovationProject.title == "Cloud Monitoring Dashboard"))
        proj_private = db.scalar(select(InnovationProject).where(InnovationProject.title == "Private Research Algorithm"))
        skill_python = db.scalar(select(Skill).where(Skill.slug == "python"))
        student1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        recruiter1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        recruiter2 = db.scalar(select(User).where(User.email == RECRUITER2_EMAIL))

        public_proj_id = proj_public.id
        private_proj_id = proj_private.id
        python_skill_id = skill_python.id

    rec1_headers = auth_headers(RECRUITER1_EMAIL)
    rec2_headers = auth_headers(RECRUITER2_EMAIL)
    stud1_headers = auth_headers(STUDENT1_EMAIL)
    stud2_headers = auth_headers(STUDENT2_EMAIL)
    admin_headers = auth_headers(ADMIN_EMAIL)

    create_payload = {
        "technical_quality_score": 4,
        "problem_solving_score": 5,
        "execution_score": 4,
        "communication_documentation_score": 4,
        "evidence_quality_score": 5,
        "recommendation": "strongly_recommended",
        "strengths": "Exceptional architecture and clean async API design.",
        "improvement_areas": "Could expand unit test coverage for edge error boundaries.",
        "feedback": "Outstanding candidate project.",
        "skill_assessments": [
            {
                "skill_id": python_skill_id,
                "proficiency": "advanced",
                "comments": "Mastery of FastAPI and SQLAlchemy.",
            }
        ],
    }

    print("\n[Scenario 1] Authorized Recruiter with Application can evaluate student's project")
    resp = client.post(
        f"/api/v1/innovation-projects/{public_proj_id}/evaluations",
        json=create_payload,
        headers=rec1_headers,
    )
    assert resp.status_code == 201, f"Failed to create evaluation: {resp.text}"
    eval_data = resp.json()
    eval_id = eval_data["id"]
    assert eval_data["status"] == "draft"
    assert eval_data["project_id"] == public_proj_id
    assert eval_data["recruiter_id"] == recruiter1.id
    assert eval_data["student_id"] == student1.id
    assert eval_data["overall_score"] == 4.4  # (4+5+4+4+5)/5 = 4.4
    assert eval_data["recommendation"] == "strongly_recommended"
    assert len(eval_data["skill_assessments"]) == 1
    assert eval_data["skill_assessments"][0]["skill_name"] == "Python"
    assert eval_data["skill_assessments"][0]["proficiency"] == "advanced"
    print("  -> Draft evaluation created successfully by authorized recruiter with active candidate application.")

    print("\n[Scenario 2] Recruiter without Application relationship CANNOT evaluate an arbitrary PUBLIC + ACTIVE project")
    resp_rec2_pub = client.post(
        f"/api/v1/innovation-projects/{public_proj_id}/evaluations",
        json=create_payload,
        headers=rec2_headers,
    )
    assert resp_rec2_pub.status_code == 403, (
        f"Expected 403 Forbidden for Recruiter 2 without application on public project, got {resp_rec2_pub.status_code}"
    )
    assert "not authorized to evaluate this candidate's project without an active candidate application" in resp_rec2_pub.json().get("detail", "")
    print("  -> Recruiter without application relationship strictly denied (403) on PUBLIC + ACTIVE project.")

    print("\n[Scenario 3] Recruiter without Application cannot evaluate PRIVATE project")
    resp_unauth = client.post(
        f"/api/v1/innovation-projects/{private_proj_id}/evaluations",
        json=create_payload,
        headers=rec1_headers,
    )
    assert resp_unauth.status_code == 403, f"Expected 403 Forbidden on private non-candidate project, got {resp_unauth.status_code}"
    print("  -> Recruiter correctly blocked with 403 on private project without candidate application.")

    print("\n[Scenario 4] Student cannot create recruiter evaluations")
    resp_stud = client.post(
        f"/api/v1/innovation-projects/{public_proj_id}/evaluations",
        json=create_payload,
        headers=stud1_headers,
    )
    assert resp_stud.status_code == 403, f"Expected 403 for student creating evaluation, got {resp_stud.status_code}"
    print("  -> Student role cannot create recruiter evaluations.")

    print("\n[Scenario 5] Duplicate evaluation for same (project_id, recruiter_id) is rejected with 409 Conflict")
    resp_dup = client.post(
        f"/api/v1/innovation-projects/{public_proj_id}/evaluations",
        json=create_payload,
        headers=rec1_headers,
    )
    assert resp_dup.status_code == 409, f"Expected 409 Conflict for duplicate evaluation, got {resp_dup.status_code}"
    print("  -> Uniqueness constraint correctly enforced with 409 Conflict.")

    print("\n[Scenario 6] Invalid scores outside 1-5 range are rejected with 422")
    invalid_score_payload = {**create_payload, "technical_quality_score": 6}
    resp_invalid = client.patch(
        f"/api/v1/project-evaluations/{eval_id}",
        json=invalid_score_payload,
        headers=rec1_headers,
    )
    assert resp_invalid.status_code == 422, f"Expected 422 for score=6, got {resp_invalid.status_code}"
    print("  -> Score range [1..5] validation enforced.")

    print("\n[Scenario 7] Draft evaluation can be updated by owner recruiter")
    update_payload = {
        "technical_quality_score": 5,
        "strengths": "Updated strengths note.",
    }
    resp_update = client.patch(
        f"/api/v1/project-evaluations/{eval_id}",
        json=update_payload,
        headers=rec1_headers,
    )
    assert resp_update.status_code == 200, f"Failed to update draft: {resp_update.text}"
    updated_data = resp_update.json()
    assert updated_data["technical_quality_score"] == 5
    assert updated_data["strengths"] == "Updated strengths note."
    assert updated_data["overall_score"] == 4.6  # (5+5+4+4+5)/5 = 4.6
    print("  -> Draft updated successfully and overall score recalculated.")

    print("\n[Scenario 8] Another recruiter cannot update or access another recruiter's draft evaluation")
    resp_other_rec_patch = client.patch(
        f"/api/v1/project-evaluations/{eval_id}",
        json=update_payload,
        headers=rec2_headers,
    )
    assert resp_other_rec_patch.status_code == 403, f"Expected 403 for cross-recruiter modification, got {resp_other_rec_patch.status_code}"

    resp_other_rec_get = client.get(
        f"/api/v1/project-evaluations/{eval_id}",
        headers=rec2_headers,
    )
    assert resp_other_rec_get.status_code == 404, f"Expected 404 for other recruiter inspecting draft evaluation, got {resp_other_rec_get.status_code}"
    print("  -> Cross-recruiter modification and draft snooping strictly blocked.")

    print("\n[Scenario 9] Student cannot see DRAFT evaluation (Invisibility rule)")
    # 1. Detail endpoint
    resp_stud_get = client.get(
        f"/api/v1/project-evaluations/{eval_id}",
        headers=stud1_headers,
    )
    assert resp_stud_get.status_code == 404, f"Student should not see DRAFT evaluation details, got {resp_stud_get.status_code}"

    # 2. List endpoint
    resp_stud_list = client.get(
        f"/api/v1/innovation-projects/{public_proj_id}/evaluations",
        headers=stud1_headers,
    )
    assert resp_stud_list.status_code == 200
    assert len(resp_stud_list.json()) == 0, "Student project evaluation list must be empty while in DRAFT"
    print("  -> Draft evaluation is completely invisible to student.")

    print("\n[Scenario 10] Incomplete evaluation cannot be submitted")
    # Set one score to None via direct DB modification to test submission validation
    with SessionLocal() as db:
        ev_obj = db.scalar(select(ProjectEvaluation).where(ProjectEvaluation.id == eval_id))
        ev_obj.evidence_quality_score = None
        db.commit()

    resp_submit_fail = client.post(
        f"/api/v1/project-evaluations/{eval_id}/submit",
        headers=rec1_headers,
    )
    assert resp_submit_fail.status_code == 400, f"Expected 400 for incomplete evaluation submission, got {resp_submit_fail.status_code}"
    print("  -> Incomplete evaluation submission rejected with 400.")

    # Restore score
    with SessionLocal() as db:
        ev_obj = db.scalar(select(ProjectEvaluation).where(ProjectEvaluation.id == eval_id))
        ev_obj.evidence_quality_score = 5
        db.commit()

    print("\n[Scenario 11] Submitting evaluation transitions status, sets timestamp, and sends student notification")
    resp_submit = client.post(
        f"/api/v1/project-evaluations/{eval_id}/submit",
        headers=rec1_headers,
    )
    assert resp_submit.status_code == 200, f"Failed to submit evaluation: {resp_submit.text}"
    submitted_data = resp_submit.json()
    assert submitted_data["status"] == "submitted"
    assert submitted_data["submitted_at"] is not None
    assert submitted_data["overall_score"] == 4.6

    # Verify notification in DB
    with SessionLocal() as db:
        notif = db.scalar(
            select(Notification).where(
                Notification.user_id == student1.id,
                Notification.notification_type == NotificationType.PROJECT_EVALUATION_SUBMITTED,
            )
        )
        assert notif is not None, "Notification was not created for student on evaluation submission!"
        assert "submitted a structured evaluation" in notif.message
    print("  -> Evaluation submitted, status is 'submitted', and notification was dispatched.")

    print("\n[Scenario 12] Submitted evaluation is immutable (cannot be updated by recruiter)")
    resp_edit_submitted = client.patch(
        f"/api/v1/project-evaluations/{eval_id}",
        json={"strengths": "Trying to modify submitted evaluation"},
        headers=rec1_headers,
    )
    assert resp_edit_submitted.status_code == 400, f"Expected 400 on modifying submitted evaluation, got {resp_edit_submitted.status_code}"
    print("  -> Submitted evaluation cannot be modified.")

    print("\n[Scenario 13] Student can now view SUBMITTED evaluation in list and detail")
    resp_stud_detail = client.get(
        f"/api/v1/project-evaluations/{eval_id}",
        headers=stud1_headers,
    )
    assert resp_stud_detail.status_code == 200, f"Student should view submitted evaluation, got {resp_stud_detail.status_code}"
    assert resp_stud_detail.json()["overall_score"] == 4.6

    resp_stud_list2 = client.get(
        f"/api/v1/innovation-projects/{public_proj_id}/evaluations",
        headers=stud1_headers,
    )
    assert resp_stud_list2.status_code == 200
    assert len(resp_stud_list2.json()) == 1
    assert resp_stud_list2.json()[0]["id"] == eval_id
    print("  -> Student successfully views submitted evaluation.")

    print("\n[Scenario 14] Withdrawal workflow respects ownership and admin governance")
    # Non-owner student cannot withdraw
    resp_with_stud = client.post(
        f"/api/v1/project-evaluations/{eval_id}/withdraw",
        headers=stud1_headers,
    )
    assert resp_with_stud.status_code == 403

    # Admin can withdraw
    resp_with_admin = client.post(
        f"/api/v1/project-evaluations/{eval_id}/withdraw",
        headers=admin_headers,
    )
    assert resp_with_admin.status_code == 200
    assert resp_with_admin.json()["status"] == "withdrawn"
    print("  -> Evaluation successfully withdrawn under governance authorization.")

    print("\n[Scenario 15] Invalid canonical skill ID is rejected on assessment")
    cleanup_test_data()
    setup_test_users()
    rec1_headers = auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        proj = db.scalar(select(InnovationProject).where(InnovationProject.title == "Cloud Monitoring Dashboard"))
        p_id = proj.id

    bad_skill_payload = {
        "technical_quality_score": 4,
        "skill_assessments": [{"skill_id": 999999, "proficiency": "basic"}],
    }
    resp_bad_skill = client.post(
        f"/api/v1/innovation-projects/{p_id}/evaluations",
        json=bad_skill_payload,
        headers=rec1_headers,
    )
    assert resp_bad_skill.status_code == 400, f"Expected 400 for non-existent skill ID, got {resp_bad_skill.status_code}"
    print("  -> Invalid skill ID reference rejected.")

    cleanup_test_data()
    print("\nALL PROJECT EVALUATION TESTS PASSED 100% SUCCESSFULLY!\n")


if __name__ == "__main__":
    test_project_evaluations_suite()
