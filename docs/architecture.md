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
- **Phase 16**: `skills`, `student_skills`
- **Phase 17-20**: `notifications`, `interviews`, `conversations`, `messages`, `audit_logs`

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





