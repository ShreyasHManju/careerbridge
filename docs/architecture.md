# CareerBridge — System Architecture & Design

## 1. High-Level Architecture Overview

CareerBridge is built on a clean multi-tier architecture separating the client application from the core business logic and database persistence.

                    +--------------------+
                    |       Client       |
                    | React + TypeScript |
                    +---------+----------+
                              |
                              | REST API (JSON)
                              v
                    +--------------------+
                    |   FastAPI Backend  |
                    |  (Routers & Deps)  |
                    +---------+----------+
                              |
                              | Pydantic Validation & Security
                              v
                    +--------------------+
                    |  Service Layer &   |
                    |  Business Rules    |
                    +---------+----------+
                              |
                              | SQLAlchemy ORM
                              v
                    +--------------------+
                    |     PostgreSQL     |
                    |  Relational DB     |
                    +--------------------+

---

## 2. Request Lifecycle (Vertical Slice Flow)

Every request follows a rigorous vertical slice to ensure safety, auditability, and data integrity:

1. **Client**: React frontend issues an HTTP request using an Axios/Fetch client.
2. **FastAPI Router**: Receives request and triggers dependency injection:
   - Authenticates JWT token via get_current_user.
   - Evaluates RBAC permissions (e.g., `require_role(UserRole.RECRUITER)`).
3. **Pydantic Schema Validation**: Request payload is parsed and strictly validated against defined schema models.
4. **Service Layer**: Executes domain logic and checks business rules (e.g., verify company approval status, check application deadline).
5. **Data Access (SQLAlchemy ORM)**: Executes parameterized queries against PostgreSQL inside a managed database session transaction.
6. **Response Serialization**: Safe Pydantic response models filter out sensitive fields (like password hashes) before sending JSON back to the client.

---

## 3. Role-Based Access Control (RBAC)

The system enforces three primary roles directly on the FastAPI backend:

| Role | Permissions & Scope |
| :--- | :--- |
| **Student** | Browse/search internships, maintain student profile, upload resume, submit applications, track application status, withdraw applications, save internships. |
| **Recruiter** | Create and manage company profile, submit verification documents, post/edit/publish internships (once verified), review student applications, schedule interviews, update application statuses. |
| **Admin** | Full platform governance: verify/reject companies, moderate internships, manage user accounts, review audit logs, view platform-wide metrics. |

---

## 4. Database Schema Roadmap

- **Phase 1-5**: `users` (core accounts, bcrypt credentials, role enums)
- **Phase 8**: `student_profiles` (1-to-1 extension with cascading deletes, education/contact metadata)
- **Phase 9**: `recruiter_profiles` (1-to-1 extension with cascading deletes, organization/contact metadata)
- **Phase 10**: `job_postings` (1-to-many opportunities posted by recruiters with cascading deletes)
- **Phase 11**: `applications` (many-to-1 with `job_postings` and `users`, unique constraint on `(job_posting_id, student_id)`, status lifecycle pipeline: applied -> reviewing -> shortlisted -> rejected / accepted)
- **Phase 12**: Database-side search, multi-faceted filtering, controlled sorting, and offset/limit pagination on `job_postings`
- **Phase 13**: `resumes` (1-to-1 extension with `users`, unique constraint on `student_id`, document metadata persistence, physical file storage abstraction, secure MIME/magic-byte validation)
- **Phase 14**: `profile_images` (1-to-1 extension with `users`, unique constraint on `student_id`, image metadata persistence, physical image storage abstraction, secure JPEG/PNG/WebP magic-byte validation, 2MB limit)
- **Phase 15**: `saved_jobs` (many-to-1 with `job_postings` and `users`, unique constraint on `(student_id, job_posting_id)`, cascade delete on jobs and users, newest-saved ordering)
-**Phase 16**: `recruiter_profiles.is_verified` (Boolean column added via Alembic migration `01b1d6a76f10` for admin recruiter verification)
- **Phase 17**: `notifications` (many-to-1 with `users`, cascading delete, indexed on `(user_id, is_read)` and `(user_id, created_at)`, enum `notification_type`)
- **Phase 18-21**: `interviews`, `conversations`, `messages`, `audit_logs`

---

## 5. Domain Ownership & Security Model

CareerBridge separates identity and access into three explicit tiers:

1. **Authentication ("Who are you?")**: Verified cryptographically via `get_current_user` reading the JWT Bearer token and verifying the active account in PostgreSQL.
2. **Role Authorization ("What group do you belong to?")**: Enforced via `require_role(allowed_roles)`. Protects routes from unauthorized roles (e.g. students attempting recruiter creation/modification return `403 Forbidden`).
3. **Resource Ownership ("Do you own this specific record?")**: Strictly derived from `current_user.id`. Endpoints never accept `user_id`, `recruiter_id`, or `student_id` from client payloads. Queries filter by `Model.user_id == current_user.id` (for profiles), `JobPosting.recruiter_id == current_user.id` (for postings), `Application.student_id == current_user.id` (for student application tracking), `Resume.student_id == current_user.id` (for student resume management), `ProfileImage.student_id == current_user.id` (for student profile image management), or `SavedJob.student_id == current_user.id` (for saved jobs / bookmarks), preventing horizontal privilege escalation (IDOR) and ownership spoofing.

---

## 6. Document & Image File Storage Architecture (Phases 13 & 14)

CareerBridge utilizes a hybrid storage architecture for user uploads and binary documents:
- **Relational Metadata (PostgreSQL)**: The `resumes` and `profile_images` tables store document/image provenance: `id`, `student_id`, `original_filename`, `stored_filename`, `file_path`, `content_type`, `file_size`, and timestamps.
- **Physical Document & Image Storage (Filesystem)**: Binary files are stored in dedicated subdirectories under `backend/uploads/` (`backend/uploads/resumes/` for resumes and `backend/uploads/profile_images/` for student photos, configurable via `UPLOAD_DIR` in `backend/app/core/config.py`).
- **UUID Filename Obfuscation**: Files are saved with non-guessable UUID names (e.g. `c9bf587f...docx` or `e4a19b22...png`) to prevent predictable file enumeration, overwrites, and collision attacks.
- **Path Traversal Protection**: All generated paths are verified via `dest_path.relative_to(base_dir)` to guarantee no upload or retrieval operations escape their respective storage directory.
- **Magic Byte Validation**: Rather than trusting user-provided file extensions or client headers, file headers are inspected against verified binary signatures:
  - Resumes: `%PDF` for PDF, `\xd0\xcf\x11\xe0` for DOC, `PK\x03\x04` for DOCX.
  - Profile Images: `FF D8 FF` for JPEG, `89 50 4E 47 0D 0A 1A 0A` for PNG, `RIFF....WEBP` for WebP.
- **Streamed Size Limiting**: Files are processed in 64KB chunks up to configured limits (`MAX_RESUME_SIZE_MB=5` for resumes, `MAX_PROFILE_IMAGE_SIZE_MB=2` for profile images). Exceeding files are unlinked immediately without buffering into server RAM.
- **Safe Atomic Replacement**: When a student uploads a replacement document or image, the new file is saved and verified, the database metadata is updated within a transaction, and the old physical file is only unlinked after the transaction successfully commits.

---

## 7. Saved Jobs & Internships Architecture (Phase 15)

The Saved Jobs subsystem implements candidate bookmarking and tracking for job and internship postings:
- **Relational Representation**: Stored in `saved_jobs` (`id`, `student_id`, `job_posting_id`, `created_at`).
- **Engine-Level Deduplication**: Unique constraint `uq_saved_job_student_job` enforces that a student can bookmark a posting at most once. Concurrency conflicts safely rollback and return `409 Conflict`.
- **Referential Integrity**: Cascading deletes on foreign keys to `users.id` and `job_postings.id` eliminate orphaned bookmark rows.
- **Ordered Discovery**: Saved opportunities are retrieved newest-saved first (`ORDER BY saved_jobs.created_at DESC, saved_jobs.id DESC`) with `joinedload(SavedJob.job_posting)` to avoid N+1 database queries.
- **Deactivation Handling**: Opportunities saved while active remain preserved in student bookmarks even if later deactivated (`is_active: false`), maintaining tracking historical integrity.

---

## 8. Administrative Management & Moderation Architecture (Phase 16)

The Administration and Moderation subsystem equips system administrators (`UserRole.ADMIN`) with centralized control over platform actors and content:
- **Centralized Admin RBAC**: All admin operations enforce `current_user: User = Depends(require_role(UserRole.ADMIN))` based on verified database records. Students and Recruiters are rejected with `403 Forbidden`. Inactive accounts receive `401 Unauthorized`.
- **User Governance**:
  - `GET /api/v1/admin/users`: Database-side search on email, filtering by role and active status, ordered newest-first with pagination envelope.
  - `GET /api/v1/admin/users/{user_id}`: Inspect user account details safely without leaking credentials.
  - `PATCH /api/v1/admin/users/{user_id}/status`: Toggle account active state (`is_active: bool`).
- **Self-Lockout Prevention**: Prohibits an administrator from deactivating their own currently authenticated account (`target_user.id == current_user.id and not is_active` returns `400 Bad Request`).
- **Recruiter Profile Verification**:
  - `RecruiterProfile.is_verified: bool` tracks institutional vetting in PostgreSQL.
  - `GET /api/v1/admin/recruiters`: Search and verification filter across companies with joined user queries to prevent N+1 overhead.
  - `PATCH /api/v1/admin/recruiters/{user_id}/verification`: Verifies/unverifies a recruiter profile, updating both profile and user account verification flags.
- **Job Posting Moderation**:
  - `GET /api/v1/admin/jobs`: Comprehensive listing across all companies, exposing both active and inactive postings.
  - `PATCH /api/v1/admin/jobs/{job_id}/status`: Moderates opportunity visibility (`is_active: bool`) while keeping posting ownership and opportunity terms immutable.

---

## 9. In-App Notifications & Background Jobs Architecture (Phase 17)

The Notifications and Background Jobs subsystem handles event-driven user updates and non-blocking asynchronous task execution:
- **Relational Representation (`notifications`)**:
  - Columns: `id`, `user_id` (FK to `users.id`, `ondelete="CASCADE"`), `notification_type` (Enum: `application_submitted`, `application_status_changed`, `recruiter_verification_changed`, `job_moderation_changed`), `title`, `message`, `is_read`, `created_at`, `read_at`.
  - Indexes: individual indexes on `user_id`, `is_read`, `created_at` plus composite indexes `ix_notifications_user_id_is_read` and `ix_notifications_user_id_created_at`.
- **Event-Driven Triggers**:
  - Application Submission: Notifies the recruiter who owns the job posting.
  - Application Status Update: Notifies the student applicant when a recruiter advances their candidacy.
  - Recruiter Verification: Notifies the recruiter when an administrator verifies/unverifies their organization.
  - Job Moderation: Notifies the recruiter when an administrator activates/deactivates their posting.
- **Strict Ownership Isolation**:
  - Recipients are strictly identified by `current_user.id`.
  - Attempting to inspect or modify another user's notifications returns `404 Not Found`.
- **Single-Query Bulk Mutations**:
  - `PATCH /api/v1/notifications/read-all` executes a single SQL `UPDATE` statement to set `is_read=True` and `read_at=now()` for all unread items belonging to `current_user.id`.
  - `GET /api/v1/notifications/unread-count` executes a direct `COUNT` query on `(user_id, is_read=False)`.
- **Background Jobs Framework (`app.services.background_jobs`)**:
  - In-memory execution abstraction compatible with FastAPI's `BackgroundTasks`.
  - Encapsulates error handling and logging so background task failures never crash the active HTTP request.
  - Provides a consistent callable contract ready for drop-in replacement with distributed task brokers (e.g. Redis / Celery) in future phases.

---

## 10. Interview Scheduling & Lifecycle Architecture (Phase 18)

The Interview Management & Scheduling subsystem provides recruiters and candidate students with a complete, collision-safe interview coordination framework:
- **Relational Representation (`interviews`)**:
  - Stored in `interviews` table with foreign keys `application_id`, `recruiter_id`, `student_id` linked with `ondelete="CASCADE"`.
  - Composite indexes `(recruiter_id, scheduled_at)` and `(student_id, scheduled_at)` optimize interval conflict scans and chronological retrieval.
  - Supported enums: `InterviewType` (`online`, `in_person`, `phone`) and `InterviewStatus` (`scheduled`, `completed`, `cancelled`, `rescheduled`).
- **Collision Protection Algorithm**:
  - Overlap is defined by standard interval intersection:
    $$\text{Start}_{\text{new}} < \text{End}_{\text{existing}} \quad \land \quad \text{End}_{\text{new}} > \text{Start}_{\text{existing}}$$
  - Conflict detection verifies both the recruiter and candidate schedules across active sessions (`SCHEDULED`, `RESCHEDULED`).
  - Cancelled sessions (`CANCELLED`) are omitted from conflict evaluation, releasing calendar availability immediately.
- **Application Eligibility Gatekeeping**:
  - Scheduling is restricted to applications in candidate progression states: `APPLIED`, `REVIEWING`, `SHORTLISTED`.
  - Terminal or completed statuses (`REJECTED`, `ACCEPTED`) return `400 Bad Request`.
- **Ownership & Authorization**:
  - Scheduling, updating, and cancelling are restricted strictly to the recruiter who created the associated job posting (`403 Forbidden` for other recruiters or roles).
  - Single interview inspection (`GET /api/v1/interviews/{interview_id}`) is permitted for the recruiter owner, the candidate student, or a platform administrator.
- **Soft Cancellation & Slot Release**:
  - Cancelling an interview (`DELETE /api/v1/interviews/{interview_id}`) updates `status = CANCELLED`, dispatches an in-app notification to the candidate, and releases the timeslot without purging historical audit logs.
- **Notification Integration**:
  - Emits in-app lifecycle notifications to the student (`INTERVIEW_SCHEDULED`, `INTERVIEW_RESCHEDULED`, `INTERVIEW_CANCELLED`).
  - Updating notes or meeting links only retains the existing status and suppresses redundant notifications.








