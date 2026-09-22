from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from app.core.database import engine
from app.models import Base


def test_migrations():
    print("[1/5] Verifying Alembic configuration and ScriptDirectory")
    base_dir = Path(__file__).resolve().parent
    alembic_cfg = Config(str(base_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(base_dir / "alembic"))
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    head_revision = script_dir.get_current_head()
    print(f"  -> Alembic head revision from script directory: {head_revision}")
    assert head_revision is not None, "No migration head found in script directory"

    print("[2/5] Verifying target metadata discovery")
    assert "users" in Base.metadata.tables, "Table 'users' missing from Base.metadata"
    assert "saved_jobs" in Base.metadata.tables, "Table 'saved_jobs' missing from Base.metadata"
    assert "notifications" in Base.metadata.tables, "Table 'notifications' missing from Base.metadata"
    assert "notification_preferences" in Base.metadata.tables, "Table 'notification_preferences' missing from Base.metadata"
    assert "interviews" in Base.metadata.tables, "Table 'interviews' missing from Base.metadata"
    assert "conversations" in Base.metadata.tables, "Table 'conversations' missing from Base.metadata"
    assert "conversation_participants" in Base.metadata.tables, "Table 'conversation_participants' missing from Base.metadata"
    assert "messages" in Base.metadata.tables, "Table 'messages' missing from Base.metadata"
    print("  -> Base.metadata contains messaging tables.")

    print("[3/11] Verifying database schema after migration")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"  -> Tables found in PostgreSQL: {tables}")
    assert "users" in tables, "Table 'users' not found in database!"
    assert "student_profiles" in tables, "Table 'student_profiles' not found in database!"
    assert "recruiter_profiles" in tables, "Table 'recruiter_profiles' not found in database!"
    assert "job_postings" in tables, "Table 'job_postings' not found in database!"
    assert "applications" in tables, "Table 'applications' not found in database!"
    assert "resumes" in tables, "Table 'resumes' not found in database!"
    assert "profile_images" in tables, "Table 'profile_images' not found in database!"
    assert "saved_jobs" in tables, "Table 'saved_jobs' not found in database!"
    assert "notifications" in tables, "Table 'notifications' not found in database!"
    assert "notification_preferences" in tables, "Table 'notification_preferences' not found in database!"
    assert "interviews" in tables, "Table 'interviews' not found in database!"
    assert "conversations" in tables, "Table 'conversations' not found in database!"
    assert "conversation_participants" in tables, "Table 'conversation_participants' not found in database!"
    assert "messages" in tables, "Table 'messages' not found in database!"
    assert "alembic_version" in tables, "Table 'alembic_version' not found in database!"

    print("[4/9] Verifying 'users' table columns and indexes")
    columns = {col["name"]: col for col in inspector.get_columns("users")}
    expected_cols = [
        "id",
        "email",
        "password_hash",
        "role",
        "is_active",
        "is_verified",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_cols:
        assert col_name in columns, f"Column '{col_name}' missing from 'users' table"
        print(f"     - {col_name}: {columns[col_name]['type']} (nullable={columns[col_name]['nullable']})")

    indexes = inspector.get_indexes("users")
    print(f"  -> Indexes on 'users': {[idx['name'] for idx in indexes]}")
    index_names = [idx["name"] for idx in indexes]
    assert any("email" in name for name in index_names), "Email index missing from 'users' table"

    print("[5/9] Verifying 'student_profiles' table columns, indexes, and FKs")
    sp_columns = {col["name"]: col for col in inspector.get_columns("student_profiles")}
    expected_sp_cols = [
        "id",
        "user_id",
        "full_name",
        "phone",
        "college",
        "degree",
        "branch",
        "graduation_year",
        "bio",
        "skills",
        "github_url",
        "linkedin_url",
        "portfolio_url",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_sp_cols:
        assert col_name in sp_columns, f"Column '{col_name}' missing from 'student_profiles' table"
        print(f"     - {col_name}: {sp_columns[col_name]['type']} (nullable={sp_columns[col_name]['nullable']})")

    sp_indexes = inspector.get_indexes("student_profiles")
    print(f"  -> Indexes on 'student_profiles': {[idx['name'] for idx in sp_indexes]}")
    sp_fks = inspector.get_foreign_keys("student_profiles")
    print(f"  -> Foreign keys on 'student_profiles': {sp_fks}")
    assert any(fk.get("referred_table") == "users" for fk in sp_fks), "Foreign key to 'users' table missing!"

    print("[6/9] Verifying 'recruiter_profiles' table columns, indexes, and FKs")
    rp_columns = {col["name"]: col for col in inspector.get_columns("recruiter_profiles")}
    expected_rp_cols = [
        "id",
        "user_id",
        "company_name",
        "company_description",
        "contact_name",
        "phone",
        "company_website",
        "company_location",
        "industry",
        "company_size",
        "is_verified",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_rp_cols:
        assert col_name in rp_columns, f"Column '{col_name}' missing from 'recruiter_profiles' table"
        print(f"     - {col_name}: {rp_columns[col_name]['type']} (nullable={rp_columns[col_name]['nullable']})")

    rp_indexes = inspector.get_indexes("recruiter_profiles")
    print(f"  -> Indexes on 'recruiter_profiles': {[idx['name'] for idx in rp_indexes]}")
    rp_fks = inspector.get_foreign_keys("recruiter_profiles")
    print(f"  -> Foreign keys on 'recruiter_profiles': {rp_fks}")
    assert any(fk.get("referred_table") == "users" for fk in rp_fks), "Foreign key to 'users' table missing on recruiter_profiles!"

    print("[7/9] Verifying 'job_postings' table columns, indexes, and FKs")
    jp_columns = {col["name"]: col for col in inspector.get_columns("job_postings")}
    expected_jp_cols = [
        "id",
        "recruiter_id",
        "title",
        "description",
        "opportunity_type",
        "company_name",
        "location",
        "is_remote",
        "employment_type",
        "skills",
        "minimum_qualification",
        "experience_required",
        "salary_min",
        "salary_max",
        "application_deadline",
        "is_active",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_jp_cols:
        assert col_name in jp_columns, f"Column '{col_name}' missing from 'job_postings' table"
        print(f"     - {col_name}: {jp_columns[col_name]['type']} (nullable={jp_columns[col_name]['nullable']})")

    jp_indexes = inspector.get_indexes("job_postings")
    print(f"  -> Indexes on 'job_postings': {[idx['name'] for idx in jp_indexes]}")
    jp_fks = inspector.get_foreign_keys("job_postings")
    print(f"  -> Foreign keys on 'job_postings': {jp_fks}")
    assert any(fk.get("referred_table") == "users" for fk in jp_fks), "Foreign key to 'users' table missing on job_postings!"

    print("[8/9] Verifying 'applications' table columns, indexes, FKs, and constraints")
    app_columns = {col["name"]: col for col in inspector.get_columns("applications")}
    expected_app_cols = [
        "id",
        "job_posting_id",
        "student_id",
        "status",
        "cover_message",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_app_cols:
        assert col_name in app_columns, f"Column '{col_name}' missing from 'applications' table"
        print(f"     - {col_name}: {app_columns[col_name]['type']} (nullable={app_columns[col_name]['nullable']})")

    app_fks = inspector.get_foreign_keys("applications")
    print(f"  -> Foreign keys on 'applications': {app_fks}")
    referred_tables = {fk.get("referred_table") for fk in app_fks}
    assert "users" in referred_tables, "Foreign key to 'users' table missing on applications!"
    assert "job_postings" in referred_tables, "Foreign key to 'job_postings' table missing on applications!"

    app_unique_constraints = inspector.get_unique_constraints("applications")
    print(f"  -> Unique constraints on 'applications': {app_unique_constraints}")
    uq_names = [uq["name"] for uq in app_unique_constraints]
    assert any("uq_job_posting_student_application" in name for name in uq_names), (
        "Unique constraint 'uq_job_posting_student_application' missing on applications!"
    )

    print("[9/10] Verifying 'resumes' table columns, indexes, FKs, and constraints")
    resume_columns = {col["name"]: col for col in inspector.get_columns("resumes")}
    expected_resume_cols = [
        "id",
        "student_id",
        "original_filename",
        "stored_filename",
        "file_path",
        "content_type",
        "file_size",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_resume_cols:
        assert col_name in resume_columns, f"Column '{col_name}' missing from 'resumes' table"
        print(f"     - {col_name}: {resume_columns[col_name]['type']} (nullable={resume_columns[col_name]['nullable']})")

    resume_fks = inspector.get_foreign_keys("resumes")
    print(f"  -> Foreign keys on 'resumes': {resume_fks}")
    referred_tables = {fk.get("referred_table") for fk in resume_fks}
    assert "users" in referred_tables, "Foreign key to 'users' table missing on resumes!"

    resume_indexes = inspector.get_indexes("resumes")
    print(f"  -> Indexes on 'resumes': {resume_indexes}")
    student_id_idx = [idx for idx in resume_indexes if "student_id" in idx["column_names"]]
    assert any(idx.get("unique") is True for idx in student_id_idx), (
        "Unique index on 'student_id' missing on resumes table!"
    )

    print("[10/11] Verifying 'profile_images' table columns, indexes, FKs, and constraints")
    image_columns = {col["name"]: col for col in inspector.get_columns("profile_images")}
    expected_image_cols = [
        "id",
        "student_id",
        "original_filename",
        "stored_filename",
        "file_path",
        "content_type",
        "file_size",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_image_cols:
        assert col_name in image_columns, f"Column '{col_name}' missing from 'profile_images' table"
        print(f"     - {col_name}: {image_columns[col_name]['type']} (nullable={image_columns[col_name]['nullable']})")

    image_fks = inspector.get_foreign_keys("profile_images")
    print(f"  -> Foreign keys on 'profile_images': {image_fks}")
    referred_tables = {fk.get("referred_table") for fk in image_fks}
    assert "users" in referred_tables, "Foreign key to 'users' table missing on profile_images!"

    image_indexes = inspector.get_indexes("profile_images")
    print(f"  -> Indexes on 'profile_images': {image_indexes}")
    img_student_id_idx = [idx for idx in image_indexes if "student_id" in idx["column_names"]]
    assert any(idx.get("unique") is True for idx in img_student_id_idx), (
        "Unique index on 'student_id' missing on profile_images table!"
    )

    print("[11/12] Verifying 'saved_jobs' table columns, indexes, FKs, and constraints")
    saved_columns = {col["name"]: col for col in inspector.get_columns("saved_jobs")}
    expected_saved_cols = [
        "id",
        "student_id",
        "job_posting_id",
        "created_at",
    ]
    for col_name in expected_saved_cols:
        assert col_name in saved_columns, f"Column '{col_name}' missing from 'saved_jobs' table"
        print(f"     - {col_name}: {saved_columns[col_name]['type']} (nullable={saved_columns[col_name]['nullable']})")

    saved_fks = inspector.get_foreign_keys("saved_jobs")
    print(f"  -> Foreign keys on 'saved_jobs': {saved_fks}")
    saved_ref_tables = {fk.get("referred_table") for fk in saved_fks}
    assert "users" in saved_ref_tables, "Foreign key to 'users' table missing on saved_jobs!"
    assert "job_postings" in saved_ref_tables, "Foreign key to 'job_postings' table missing on saved_jobs!"

    # Check unique constraint
    unique_constraints = inspector.get_unique_constraints("saved_jobs")
    print(f"  -> Unique constraints on 'saved_jobs': {unique_constraints}")
    has_unique = any(
        set(uc.get("column_names", [])) == {"student_id", "job_posting_id"}
        for uc in unique_constraints
    )
    assert has_unique, "Unique constraint on ('student_id', 'job_posting_id') missing on saved_jobs table!"

    saved_indexes = inspector.get_indexes("saved_jobs")
    print(f"  -> Indexes on 'saved_jobs': {saved_indexes}")
    saved_idx_cols = [idx["column_names"][0] for idx in saved_indexes if len(idx["column_names"]) == 1]
    assert "student_id" in saved_idx_cols, "Index on 'student_id' missing on saved_jobs table!"
    assert "job_posting_id" in saved_idx_cols, "Index on 'job_posting_id' missing on saved_jobs table!"

    print("[12/13] Verifying 'notifications' table columns, indexes, and FKs")
    notif_columns = {col["name"]: col for col in inspector.get_columns("notifications")}
    expected_notif_cols = [
        "id",
        "user_id",
        "notification_type",
        "title",
        "message",
        "is_read",
        "created_at",
        "read_at",
    ]
    for col_name in expected_notif_cols:
        assert col_name in notif_columns, f"Column '{col_name}' missing from 'notifications' table"
        print(f"     - {col_name}: {notif_columns[col_name]['type']} (nullable={notif_columns[col_name]['nullable']})")

    notif_fks = inspector.get_foreign_keys("notifications")
    print(f"  -> Foreign keys on 'notifications': {notif_fks}")
    notif_ref_tables = {fk.get("referred_table") for fk in notif_fks}
    assert "users" in notif_ref_tables, "Foreign key to 'users' table missing on notifications!"

    notif_indexes = inspector.get_indexes("notifications")
    print(f"  -> Indexes on 'notifications': {notif_indexes}")
    notif_idx_cols = [idx["column_names"] for idx in notif_indexes]
    assert ["user_id"] in notif_idx_cols, "Index on 'user_id' missing on notifications table!"
    assert ["is_read"] in notif_idx_cols, "Index on 'is_read' missing on notifications table!"
    assert ["created_at"] in notif_idx_cols, "Index on 'created_at' missing on notifications table!"

    print("[13/14] Verifying 'interviews' table columns, indexes, and FKs")
    interview_columns = {col["name"]: col for col in inspector.get_columns("interviews")}
    expected_interview_cols = [
        "id",
        "application_id",
        "recruiter_id",
        "student_id",
        "scheduled_at",
        "duration_minutes",
        "interview_type",
        "location_or_link",
        "notes",
        "status",
        "created_at",
        "updated_at",
    ]
    for col_name in expected_interview_cols:
        assert col_name in interview_columns, f"Column '{col_name}' missing from 'interviews' table"
        print(f"     - {col_name}: {interview_columns[col_name]['type']} (nullable={interview_columns[col_name]['nullable']})")

    interview_fks = inspector.get_foreign_keys("interviews")
    print(f"  -> Foreign keys on 'interviews': {interview_fks}")
    interview_ref_tables = {fk.get("referred_table") for fk in interview_fks}
    assert "applications" in interview_ref_tables, "Foreign key to 'applications' table missing on interviews!"
    assert "users" in interview_ref_tables, "Foreign key to 'users' table missing on interviews!"

    interview_indexes = inspector.get_indexes("interviews")
    print(f"  -> Indexes on 'interviews': {interview_indexes}")
    interview_idx_cols = [idx["column_names"] for idx in interview_indexes]
    assert ["application_id"] in interview_idx_cols, "Index on 'application_id' missing on interviews table!"
    assert ["recruiter_id"] in interview_idx_cols, "Index on 'recruiter_id' missing on interviews table!"
    assert ["student_id"] in interview_idx_cols, "Index on 'student_id' missing on interviews table!"
    assert ["scheduled_at"] in interview_idx_cols, "Index on 'scheduled_at' missing on interviews table!"
    assert ["status"] in interview_idx_cols, "Index on 'status' missing on interviews table!"

    print("[14/15] Verifying 'conversations', 'conversation_participants', and 'messages' tables")
    conv_columns = {col["name"]: col for col in inspector.get_columns("conversations")}
    for c in ["id", "user1_id", "user2_id", "created_at", "updated_at"]:
        assert c in conv_columns, f"Column '{c}' missing from 'conversations' table"
    conv_fks = inspector.get_foreign_keys("conversations")
    assert any(fk.get("referred_table") == "users" for fk in conv_fks)

    cp_columns = {col["name"]: col for col in inspector.get_columns("conversation_participants")}
    for c in ["id", "conversation_id", "user_id", "created_at"]:
        assert c in cp_columns, f"Column '{c}' missing from 'conversation_participants' table"

    msg_columns = {col["name"]: col for col in inspector.get_columns("messages")}
    for c in ["id", "conversation_id", "sender_id", "body", "is_read", "created_at", "read_at", "updated_at"]:
        assert c in msg_columns, f"Column '{c}' missing from 'messages' table"
    msg_fks = inspector.get_foreign_keys("messages")
    msg_ref_tables = {fk.get("referred_table") for fk in msg_fks}
    assert "conversations" in msg_ref_tables, "FK to conversations missing on messages!"
    assert "users" in msg_ref_tables, "FK to users missing on messages!"

    print("[15/16] Verifying 'notification_preferences' table columns, indexes, and FKs")
    pref_columns = {col["name"]: col for col in inspector.get_columns("notification_preferences")}
    for c in ["id", "user_id", "frequency", "email_notifications", "created_at", "updated_at"]:
        assert c in pref_columns, f"Column '{c}' missing from 'notification_preferences' table"
    pref_fks = inspector.get_foreign_keys("notification_preferences")
    assert any(fk.get("referred_table") == "users" for fk in pref_fks), "FK to users missing on notification_preferences!"

    print("[16/16] Verifying alembic_version table in PostgreSQL")
    with engine.connect() as conn:
        db_version = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        print(f"  -> Database alembic_version: {db_version}")
        assert db_version == head_revision, f"Database version ({db_version}) != Alembic head ({head_revision})"




    print("\n==========================================================")
    print("ALL BACKEND ALEMBIC MIGRATION TESTS PASSED SUCCESSFULLY!")
    print("=========================================================\n")


if __name__ == "__main__":
    test_migrations()
