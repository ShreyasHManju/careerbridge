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

---

## 11. One-to-One Messaging Architecture (Phase 19)

The Messaging subsystem provides a secure, private communication pipeline between platform users:
- **Relational Representation (`conversations`, `conversation_participants`, `messages`)**:
  - `conversations`: Canonical ordering enforced by `CheckConstraint("user1_id < user2_id")` alongside a database unique constraint `UniqueConstraint("user1_id", "user2_id")` guaranteeing that exactly one conversation exists per user pair without duplication.
  - `conversation_participants`: Association table with `(conversation_id, user_id)` uniqueness.
  - `messages`: Message entity storing body (1–5000 chars), `sender_id`, `is_read`, `read_at`, `created_at`, `updated_at`.
  - Composite indexes `(conversation_id, created_at)` and `(conversation_id, is_read)` optimize stable chronological ordering and unread calculation.
- **Strict Participant Authorization (No Admin Bypass)**:
  - Private messaging is strictly confidential between the two participants.
  - Administrators cannot view conversations, list messages, or send messages unless they are a direct participant (`403 Forbidden`).
  - Sender identity is derived strictly from verified JWT tokens (`current_user.id`).
- **Deterministic Get-or-Create**:
  - Handles concurrent creation attempts via PostgreSQL-level constraints and atomic `IntegrityError` recovery.
  - Subsequent requests resolve to the existing conversation ID without creating duplicates.
- **Database-Side Pagination & Stable Ordering**:
  - Messages are retrieved in stable chronological ascending order (`ORDER BY created_at ASC, id ASC`) with offset/limit pagination at the SQL level.
- **Read / Unread State Tracking**:
  - `PATCH /api/v1/conversations/{id}/read` performs a bulk update for messages received by the caller, populating `read_at` timestamps.
  - Senders' own messages are excluded from their own unread count.
  - `PATCH /api/v1/messages/{id}/read` supports single message read marking with sender-modification protection.
- **In-App Notification Trigger**:
  - Dispatches `NotificationType.MESSAGE_RECEIVED` notifications to the other participant upon message creation.

---

## 12. Real-Time Messaging & WebSocket Architecture (Phase 20)

The Real-Time Messaging architecture extends the one-to-one messaging foundation with a lightweight, bidirectional WebSocket transport layer:

```text
               +----------------------------------+
               |  Client (Tab 1 / Tab 2 / Device) |
               +----------------+-----------------+
                                |
                                | WS /api/v1/ws/conversations/{id}?token=<jwt>
                                v
               +----------------------------------+
               |    WebSocket Router & Auth       |
               |  (Token verify, Participant auth)|
               +----------------+-----------------+
                                |
                                v
               +----------------------------------+
               |   WebSocketConnectionManager     |
               |  (In-Memory Registry & Broadcast)|
               +--------+----------------+--------+
                        |                |
         Save Message   |                | Broadcast Event
         & Notification v                v
               +----------------+  +--------------------+
               | MessagingSvc & |  | Connected Sockets  |
               | PostgreSQL DB  |  | (All active tabs)  |
               +----------------+  +--------------------+
```

### Key Architectural Pillars
- **Real-Time Transport Layer**:
  - `WS /api/v1/ws/conversations/{conversation_id}` provides full-duplex JSON streaming for conversation participants.
  - Handshake authentication extracts JWT from query parameter `?token=<jwt>` or `Authorization` / `Sec-WebSocket-Protocol` headers.
  - Handshake authorization verifies participant access (`user1_id` or `user2_id`). Unauthorized requests, missing tokens, invalid tokens, or non-participating administrators are rejected with `1008 Policy Violation`.
- **In-Memory Connection Registry (`WebSocketConnectionManager`)**:
  - Maintained as `_connections: dict[int, dict[int, set[WebSocket]]]` (`conversation_id -> user_id -> set[WebSocket]`).
  - **Multi-Tab / Multi-Device Synchronization**: Allows multiple concurrent connections per user. Broadcasts reach all active sockets for each participant.
  - **Asynchronous Concurrent Broadcast**: Uses `asyncio.gather` for parallel frame dispatch to all target sockets. Broken or disconnected sockets are caught and pruned cleanly.
  - Automatic cleanup removes empty user and conversation dictionaries, preventing memory leaks.
- **Single Source of Truth Persistence**:
  - The WebSocket layer acts as an event distribution transport, never as a separate database.
  - Incoming `message` events invoke `MessagingService.send_message()`, guaranteeing atomic PostgreSQL persistence, sender identity enforcement (`current_user.id`), and `NotificationService` dispatch.
  - Delivered messages remain unread (`is_read = false`) until an explicit `read` event or HTTP read endpoint is invoked.
- **Offline Delivery & Reconnection**:
  - If a recipient is offline, the message is persisted to PostgreSQL and an in-app notification is queued. The recipient receives it immediately upon reconnecting or querying HTTP endpoints.
- **Bi-Directional HTTP & WebSocket Sync**:
  - HTTP actions (`POST /conversations/{id}/messages`, `PATCH /conversations/{id}/read`, `PATCH /messages/{id}/read`) broadcast real-time events to active WebSocket connections, ensuring unified platform state regardless of transport method.

---

## 13. Transactional Email Notification Architecture (Phase 21)

The Transactional Email Notification architecture provides decoupled, asynchronous, and secure email delivery across core platform lifecycle events without introducing external message brokers or third-party infrastructure dependencies.

```text
               +-------------------------------------------------------+
               |                  FastAPI HTTP Router                  |
               | (create_user / apply_to_job / update_status / etc.)  |
               +---------------------------+---------------------------+
                                           |
                                           | 1. DB Commit & Refresh
                                           | 2. dispatch_*_email(background_tasks)
                                           v
               +-------------------------------------------------------+
               |            FastAPI BackgroundTasks Queue              |
               |       (Response returned immediately to client)       |
               +---------------------------+---------------------------+
                                           |
                                           | Post-Response Execution
                                           v
               +-------------------------------------------------------+
               |               Background Jobs Framework               |
               |        (_execute_job_safe with failure isolation)     |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |                     EmailService                      |
               |  (Template rendering, HTML escaping, context merging)|
               +---------------------------+---------------------------+
                                           |
                                           | provider.send()
                                           v
                      +--------------------+--------------------+
                      |                                         |
                      v                                         v
       +------------------------------+          +------------------------------+
       |      LocalEmailProvider      |          |       SMTPEmailProvider      |
       |  (In-Memory for Dev/Testing) |          | (TLS/Auth Production Engine) |
       +------------------------------+          +------------------------------+
```

### Key Architectural Pillars
- **Decoupled Asynchronous Dispatch**:
  - Email sending is decoupled from HTTP request handling using FastAPI's `BackgroundTasks` combined with CareerBridge's in-memory background job framework (`background_jobs.py`).
  - Endpoints complete business mutations, persist them to PostgreSQL, and enqueue background email tasks before returning HTTP 200/201 responses immediately.
- **Total Transaction & HTTP Isolation**:
  - Email failures (network timeouts, invalid SMTP credentials, connection drops) are safely captured by `_execute_job_safe`.
  - Failures are recorded into execution history with `"status": "failed"` and logged with stack traces.
  - **Critical Invariant**: An email delivery failure will **never** roll back a database transaction or cause an HTTP error response to the client.
- **Pluggable Provider Abstraction (`BaseEmailProvider`)**:
  - `BaseEmailProvider`: Abstract base class defining `send(to_email, subject, text_body, html_body, event_type) -> bool`.
  - `LocalEmailProvider`: In-memory provider for zero-configuration development and automated testing. Captures emails in thread-safe memory with full inspection capabilities (`get_sent_emails()`, `get_last_email()`, `clear()`).
  - `SMTPEmailProvider`: Production-grade SMTP engine utilizing Python's built-in `smtplib` and `email.message.EmailMessage`. Supports configurable STARTTLS, standard ports, and credentials.
  - Provider selection is managed dynamically via `get_email_provider()` based on the `EMAIL_PROVIDER` configuration setting.
- **Dual-Format Templates & HTML Escaping**:
  - Templates for both plain-text (`.txt`) and HTML (`.html`) reside in `backend/app/templates/email/`.
  - Template rendering uses `string.Template` safe variable substitution (`$variable` notation) to eliminate parsing conflicts with CSS curly braces.
  - All user-controlled variables (student names, job titles, company names, locations, notes) are sanitized with `html.escape()` before injection into HTML templates, guaranteeing comprehensive XSS and HTML injection prevention.
- **Supported Lifecycle Events**:
  1. `WELCOME`: User account creation (`POST /api/v1/users`).
  2. `EMAIL_VERIFICATION`: Foundational verification email delivery interface.
  3. `PASSWORD_RESET`: Foundational password reset email delivery interface.
  4. `APPLICATION_CONFIRMATION`: Student job application submission (`POST /api/v1/jobs/{id}/applications`).
  5. `APPLICATION_STATUS_UPDATE`: Recruiter application status change (`PATCH /api/v1/recruiter/applications/{id}`). Only dispatches when `old_status != new_status`.
  6. `INTERVIEW_INVITATION`: Recruiter interview scheduling (`POST /api/v1/applications/{id}/interviews`).
- **Security & Privacy Guarantees**:
  - Recipient email addresses are strictly obtained from server-side database entities (e.g. `current_user.email`, `application.student.email`), never from client request bodies.
  - Plaintext passwords, password hashes, JWT secrets, and database credentials are strictly excluded from emails and logs.
  - Chat messages and WebSocket communications strictly do NOT dispatch emails, preventing inbox flooding.

---

## 14. Aggregated Role Dashboards Architecture (Phase 22)

CareerBridge provides role-specific, aggregated dashboard metrics engineered specifically to avoid loading raw relational records into client browsers. All calculations are executed directly in PostgreSQL via high-performance SQL aggregation queries and returned as structured summary objects.

```text
                  +-------------------------------------------------------------+
                  |                 HTTP Client (React / Mobile)                |
                  +------------------------------+------------------------------+
                                                 |
                       GET /api/v1/dashboard/{student | recruiter | admin}
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |               FastAPI Dashboards Router                     |
                  |  (Role-Based Access Control: STUDENT / RECRUITER / ADMIN)   |
                  +------------------------------+------------------------------+
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |                    DashboardService                         |
                  |  (Single-Query Conditional SQL Aggregations & Scoping)     |
                  +------------------------------+------------------------------+
                                                 |
                       SQL Aggregation: COUNT(), SUM(CASE...), COALESCE()
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |                     PostgreSQL Database                     |
                  |  (applications, job_postings, saved_jobs, interviews, users)|
                  +-------------------------------------------------------------+
```

### Architectural Principles & Design Decisions
- **Database-Side Computation**:
  - Eliminates client-side data bloat and high network payloads by executing aggregation logic (`COUNT`, `SUM(CASE ...)`, `COALESCE`, `TO_CHAR`) directly inside PostgreSQL.
  - No entity instances or large collections are instantiated or hydrated in Python ORM memory.
- **Strict Role Boundaries & Isolation**:
  - `GET /api/v1/dashboard/student`: Requires `UserRole.STUDENT`. Data is strictly filtered by `student_id == current_user.id`.
  - `GET /api/v1/dashboard/recruiter`: Requires `UserRole.RECRUITER`. Metrics are strictly filtered by `JobPosting.recruiter_id == current_user.id`.
  - `GET /api/v1/dashboard/admin`: Requires `UserRole.ADMIN`. Provides platform-wide KPIs, growth indicators, and application success rates.
  - Cross-role requests return `403 Forbidden`. Unauthenticated requests return `401 Unauthorized`.
  - **No Admin Bypass**: Administrators cannot query private student or recruiter dashboard endpoints, upholding absolute privacy separation.
- **Optimized Query Formulations**:
  - **Student Application Breakdown**: Uses a single SQL query with conditional summation (`SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END)`) across `applications` to fetch `total_applications`, `applications_under_review`, `shortlisted_applications`, and `accepted_applications` in one round trip.
  - **Upcoming Interviews**: Scoped to the authenticated student where `status IN ('scheduled', 'rescheduled')` and `scheduled_at >= NOW()`. Past, completed, and cancelled interviews are strictly excluded.
  - **Recruiter Pipeline**: Aggregates `active_internships` (`is_active = true`), `total_applications`, `applications_awaiting_review` (`status = 'applied'`), `shortlisted_candidates` (`status = 'shortlisted'`), and `scheduled_interviews` across all postings owned by the recruiter.
  - **Admin Application Success Rate**: Safely calculates `(accepted / total) * 100` with graceful zero-division handling (`0.0` if no applications exist).
  - **Monthly Account Registrations**: Groups account creations by `TO_CHAR(User.created_at, 'YYYY-MM')` for the target year (defaulting to the current UTC calendar year), returning structured `[{"month": "YYYY-MM", "count": N}]` items.

---

## 15. Validation & Error Handling Architecture (Phase 23)

CareerBridge incorporates a centralized, production-grade validation and error handling system. It guarantees that every error condition across the entire platform—from Pydantic validation failures and JWT authentication errors to database integrity constraints and unhandled exceptions—produces a predictable, standardized JSON response envelope while strictly safeguarding sensitive system internals.

```text
       +-------------------------------------------------------------------------+
       |                           HTTP Client Request                           |
       +------------------------------------+------------------------------------+
                                            |
                                            v
       +-------------------------------------------------------------------------+
       |               FastAPI Application & Dependency Stack                   |
       |  (Pydantic Validation, JWT Auth, RBAC, Route Handlers, Database Ops)   |
       +------------------------------------+------------------------------------+
                                            |
                                            | Exception Raised
                                            v
       +-------------------------------------------------------------------------+
       |               Centralized Exception Handlers (`app.core.error_handlers`)|
       +------------------------------------+------------------------------------+
                                            |
       +------------------------------------+------------------------------------+
       |                                    |                                    |
       v                                    v                                    v
 [AppException]               [StarletteHTTPException]            [RequestValidationError]
  Custom domain errors         Standard HTTP exceptions            FastAPI/Pydantic schemas
       |                                    |                                    |
       +-----------------+------------------+------------------------------------+
                         |
                         +-----------------------------------+
                         |                                   |
                         v                                   v
             [IntegrityError / DB Error]           [Unhandled Exception]
              Masked DB errors (409/400)            Masked 500 (InternalServer)
                         |                                   |
                         +------------------+----------------+
                                            |
                                            v
       +-------------------------------------------------------------------------+
       |                    Standard JSON Error Envelope                         |
       |  {                                                                      |
       |    "success": false,                                                    |
       |    "message": "Human-readable summary message",                         |
       |    "error_code": "MACHINE_READABLE_ERROR_CODE",                         |
       |    "detail": <string | list of field errors | object>                   |
       |  }                                                                      |
       +-------------------------------------------------------------------------+
```

### 1. Standard Error Envelope Specification

All non-2xx responses conform to a unified JSON response schema (`ErrorResponse` / `ValidationErrorResponse`):
```json
{
  "success": false,
  "message": "Could not validate credentials",
  "error_code": "AUTHENTICATION_REQUIRED",
  "detail": "Could not validate credentials"
}
```

- `success` (`bool`): Always `false` on error responses.
- `message` (`str`): Clean, human-readable summary of the error.
- `error_code` (`str`): Constant, uppercase snake_case string identifying the specific error category for programmatic frontend state handling.
- `detail` (`Any`): Detailed error context, maintaining 100% backward compatibility with standard FastAPI/Starlette response parsing.

### 2. Standard Machine-Readable Error Codes

| Error Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `422` | Request body, query parameter, or path parameter failed Pydantic schema validation. |
| `AUTHENTICATION_REQUIRED` | `401` | Missing or malformed `Authorization: Bearer <token>` header. |
| `INVALID_TOKEN` | `401` | Bearer token signature is invalid or decode failed. |
| `TOKEN_EXPIRED` | `401` | Bearer token expiration timestamp (`exp`) has elapsed. |
| `FORBIDDEN` | `403` | Authenticated user lacks the required role or organization verification. |
| `RESOURCE_OWNERSHIP_ERROR` | `403` | User attempted to view, modify, or delete a resource owned by another user. |
| `NOT_FOUND` | `404` | Requested resource, entity, or route endpoint does not exist. |
| `DUPLICATE_APPLICATION` | `409` | Student has already submitted an active application for this job posting. |
| `RESOURCE_CONFLICT` | `409` | General database unique constraint violation or conflicting concurrent operation. |
| `CONFLICTING_INTERVIEW` | `409` | Double-booking conflict for the student or recruiter at the requested time slot. |
| `INVALID_STATE` | `400` | Attempted lifecycle state transition is illegal or inactive resource operation. |
| `FILE_TOO_LARGE` | `400` | Uploaded resume or profile image exceeds configured byte limit. |
| `INVALID_FILE_TYPE` | `400` | Uploaded document or image violates MIME type or magic bytes verification. |
| `BAD_REQUEST` | `400` | Generic malformed request or client-side syntax error. |
| `INTERNAL_SERVER_ERROR` | `500` | Unhandled server exception; sanitized to prevent information disclosure. |

### 3. Domain Exception Hierarchy (`app.core.exceptions`)

CareerBridge defines a structured hierarchy rooted at `AppException(Exception)`:
- `AppException`: Base class accepting `message`, `error_code`, `status_code`, `detail`, and optional `headers`.
  - `NotFoundException` (404)
  - `AuthenticationRequiredException` (401)
  - `InvalidTokenException` (401)
  - `TokenExpiredException` (401)
  - `ForbiddenException` (403)
  - `ResourceOwnershipException` (403)
  - `DuplicateResourceException` (409)
  - `DuplicateApplicationException` (409)
  - `ConflictingInterviewException` (409)
  - `InvalidStateException` (400)
  - `ValidationException` (422)
  - `FileTooLargeException` (400)
  - `InvalidFileTypeException` (400)
  - `InternalServerException` (500)

### 4. Security & Information Disclosure Shielding

The exception handling layer enforces strict zero-leakage security boundaries:
- **Database Internals Shielding**: `IntegrityError` and `SQLAlchemyError` exceptions escaping route handlers are intercepted. Raw SQL statements, table names, primary/foreign key names, and PostgreSQL error numbers are stripped. Safe messages (`"A resource with these details already exists."`) and structured error codes (`RESOURCE_CONFLICT`) are returned.
- **Stack Trace Suppression**: Unhandled server exceptions (`Exception`) return HTTP 500 with a generic message (`"An unexpected internal server error occurred."`) and `INTERNAL_SERVER_ERROR` code. Python tracebacks, module paths, line numbers, and file paths are strictly logged server-side and never emitted in client responses.
- **Credential Protection**: Passwords, bcrypt hashes, JWT secret keys, and database connection strings are never reflected in error payloads.

---

## 16. Backend Testing Architecture (Phase 24)

CareerBridge implements an enterprise-grade backend testing architecture engineered for high speed, absolute repeatability, deterministic test isolation, and complete regression verification across all platform functional domains.

```text
       +-------------------------------------------------------------------------+
       |                      Unified Test Runner (`run_tests.py`)               |
       +------------------------------------+------------------------------------+
                                            | Discovers & Executes
                                            v
       +-------------------------------------------------------------------------+
       |                    23 Backend Test Suites (`test_*.py`)                 |
       |  (Auth, Users, RBAC, Profiles, Jobs, Search, Applications, Moderation,  |
       |   Interviews, Messages, WebSockets, Emails, Dashboards, Errors, Core)   |
       +------------------------------------+------------------------------------+
                                            | Uses Fixtures & Factories
                                            v
       +-------------------------------------------------------------------------+
       |                  Centralized Fixtures (`app.core.test_fixtures`)        |
       |  - get_test_db()                     - create_test_user()               |
       |  - generate_test_email()             - get_auth_headers()               |
       |  - create_test_job()                 - create_test_application()        |
       |  - clean_test_records()                                                 |
       +------------------------------------+------------------------------------+
                                            |
                                            v
       +-------------------------------------------------------------------------+
       |                     PostgreSQL Database Isolation                       |
       |  - Collision-Free Emails: prefix_{timestamp_ms}_{uuid6}@careerbridge.io |
       |  - Pre-Test Self-Healing Orphan Teardown                                |
       |  - Post-Test Cascaded Teardown in Strict Topological Order              |
       |  - Zero Database Pollution / Re-Run Repeatability Verified             |
       +-------------------------------------------------------------------------+
```

### Architectural Principles & Design Decisions

1. **Deterministic Isolation & Collision-Free Fixtures**:
   - Every generated test user receives an email formatted with millisecond precision and random hexadecimal entropy: `{prefix}_{timestamp_ms}_{uuid6}@careerbridge.io`.
   - Tests do not rely on hardcoded database IDs, preserving immunity from database sequence increments or parallel run interference.
   - Sessions are instantiated with `expire_on_commit=False` to prevent `DetachedInstanceError` when referencing model attributes outside transaction contexts.

2. **Topological Dependency Teardown (`clean_test_records`)**:
   - Database cleanup executes in strict topological order to respect foreign-key constraints without resorting to destructive database resets:
     1. Applications & Associated Interviews
     2. Job Postings & Bookmarked Saved Jobs
     3. User-Level Interviews & In-App Notifications
     4. Chat Messages & Conversation Participants
     5. Resumes & Profile Images (Filesystem and database records)
     6. StudentProfiles & RecruiterProfiles
     7. Users Table Records

3. **Multi-Faceted Core Roadmap Validation (`test_core_roadmap.py`)**:
   - A dedicated 16-scenario test suite explicitly tests and validates the original roadmap's 10 foundational backend requirements:
     - Registration (201, password hashing, 422 validations, 409 duplicate email rejection)
     - Login (200 JWT access token, 401 on wrong password, 401 on unknown user, 401 on inactive user)
     - Password Hashing (bcrypt salt randomness, constant-time verification)
     - Role Permissions (matrix validation across Student, Recruiter, Admin)
     - Internship/Job Creation (201 recruiter, 403 non-recruiter, 422 salary bounds)
     - Internship/Job Filtering (keyword queries, filters, pagination, inactive job isolation)
     - Application Submission (201 student, 403 non-student, 400 inactive job, 404 missing job)
     - Duplicate Application Prevention (409 conflict, database unique constraint validation)
     - Application Status Lifecycle (recruiter transitions, cross-recruiter 403, candidate visibility)
     - Admin Permissions (admin endpoints, recruiter verification, job moderation, self-lockout 400)
     - Structured JSON Error Envelope Verification (401, 403, 404, 409, 422, 500 without stacktrace/SQL leakage)

4. **Zero-Overhead Test Execution**:
   - Tests execute via standard FastAPI/Starlette `TestClient` (backed by `httpx`) without requiring separate mock servers or external test processes.
   - All 24 test suites run in ~66 seconds with 100% deterministic repeatability.

---

## 17. Security Architecture & Threat Mitigation (Phase 25)

CareerBridge follows an enterprise defense-in-depth model across transport, application, session, authorization, and data persistence layers:

```text
  +-------------------------------------------------------------------------------+
  |                              Layer 1: Network & CORS                          |
  |  - Allowed Origins: settings.cors_origins_list                                |
  |  - Preflight validation with strict credentials and methods control           |
  +---------------------------------------+---------------------------------------+
                                          |
                                          v
  +-------------------------------------------------------------------------------+
  |                          Layer 2: HTTP Security Headers                       |
  |  - Pure ASGI Middleware: X-Content-Type-Options: nosniff                      |
  |  - X-Frame-Options: DENY, X-XSS-Protection: 1; mode=block                     |
  |  - Referrer-Policy: strict-origin-when-cross-origin                           |
  +---------------------------------------+---------------------------------------+
                                          |
                                          v
  +-------------------------------------------------------------------------------+
  |                   Layer 3: Authentication & Brute-Force Rate Limiting         |
  |  - In-Memory Thread-Safe Sliding Window (RateLimiter)                         |
  |  - 5 max attempts per 60s per client IP + email address                       |
  |  - HTTP 429 RATE_LIMIT_EXCEEDED with Retry-After headers                      |
  |  - Dummy constant-time bcrypt verification on missing users                   |
  +---------------------------------------+---------------------------------------+
                                          |
                                          v
  +-------------------------------------------------------------------------------+
  |                        Layer 4: Authorization & Ownership                     |
  |  - RBAC via RoleChecker dependency injection (Student, Recruiter, Admin)      |
  |  - Cross-user tenant isolation on profiles, applications, and postings       |
  |  - Admin self-lockout deactivation defense (HTTP 400)                         |
  +---------------------------------------+---------------------------------------+
                                          |
                                          v
  +-------------------------------------------------------------------------------+
  |                    Layer 5: Storage & Persistence Hardening                   |
  |  - Upload path traversal defense (UUID-only filenames, directory containment) |
  |  - Magic bytes binary signature verification (%PDF-, JFIF, PNG)               |
  |  - Dangerous extension blocklist (.exe, .sh, .py, .php, .bat)                 |
  |  - Parameterized SQLAlchemy ORM queries (100% SQL injection immunity)         |
  |  - Sanitized 500 error envelopes without stack trace leakage                  |
  +-------------------------------------------------------------------------------+
```

### Threat Modeling & Countermeasures

| Threat Vector | Potential Impact | CareerBridge Countermeasure |
| :--- | :--- | :--- |
| **Brute-Force & Credential Stuffing** | Account compromise via automated password spraying. | Sliding window rate limiting on `/api/v1/auth/login` (max 5 failed attempts per 60s) returning HTTP 429 `RATE_LIMIT_EXCEEDED`. |
| **Username / Email Enumeration** | Attacker maps valid accounts using timing discrepancy. | Dummy bcrypt verification (`DUMMY_BCRYPT_HASH`) executed when user not found, ensuring uniform ~80ms response latency and identical generic 401 messaging. |
| **Cross-Site Request Forgery (CSRF)** | Unauthorized state mutations triggered via browser ambient credentials. | Architectural immunity: Authentication uses stateless `Authorization: Bearer <token>` HTTP headers, which web browsers never attach automatically in cross-site requests. |
| **MIME-Type Confusion & Clickjacking** | Content sniffing, iframe UI redressing. | `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` headers applied by ASGI middleware to all HTTP responses. |
| **Path Traversal & Arbitrary File Upload** | Remote code execution or host filesystem overwrite. | Upload filenames are stripped and replaced with random UUIDs; magic bytes are verified; dangerous extensions are blocklisted; files are strictly saved within configured upload directories. |
| **SQL Injection** | Unauthorized data access, table tampering, or exfiltration. | 100% parameterized queries via SQLAlchemy 2.0 ORM expressions. User inputs are always treated as literal data bindings, never concatenated into SQL strings. |
| **Information Disclosure via 500 Errors** | Server path, library version, and database schema leakage. | Centralized error handler captures unhandled exceptions and outputs sanitized JSON (`{"success": false, "message": "An unexpected internal server error occurred.", "error_code": "INTERNAL_SERVER_ERROR"}`) while recording full tracebacks only to server logs. |
| **Audit Log Incompleteness** | Untracked attacks and malicious privilege escalation. | Structured security logging via `logging.getLogger("careerbridge.security")` for failed logins (masked PII), successful logins, RBAC rejections, and admin actions. |

---

## 18. Email Notification Foundation Architecture (Phase 21)

CareerBridge incorporates a layered, asynchronous transactional email delivery architecture:

```text
                  +----------------------------------------------+
                  | FastAPI HTTP Router (Auth/Apps/Interviews)   |
                  +----------------------+-----------------------+
                                         |
                                         | 1. DB Commit & In-App Notification
                                         v
                  +----------------------------------------------+
                  | FastAPI BackgroundTasks / dispatch_job       |
                  | (Non-blocking background execution)          |
                  +----------------------+-----------------------+
                                         |
                                         | 2. Invokes Registered Handler
                                         v
                  +----------------------------------------------+
                  |                 EmailService                 |
                  | - Recipient validation (RFC-compliant regex) |
                  | - Template rendering (HTML-escaped & Text)   |
                  | - Safe parameter substitution                |
                  +----------------------+-----------------------+
                                         |
                                         | 3. Provider Delegation
                                         v
                  +----------------------------------------------+
                  |             BaseEmailProvider                |
                  +----------------------+-----------------------+
                                         |
                        +----------------+----------------+
                        |                                 |
                        v                                 v
        +-------------------------------+ +-------------------------------+
        |      LocalEmailProvider       | |       SMTPEmailProvider       |
        | - In-memory captured records  | | - Standard library smtplib    |
        | - Development & Automated CI  | | - STARTTLS & Authenticated    |
        | - Zero external dependencies  | | - Multipart (text + HTML)     |
        +-------------------------------+ +-------------------------------+
```

### Supported Transactional Email Events

| Event Type | Trigger Point | Recipient | Content & Key Parameters |
| :--- | :--- | :--- | :--- |
| **Welcome Email** | User Registration (`POST /api/v1/users`) | New User | Account creation welcome, role confirmation, and direct link to dashboard. |
| **Email Verification** | Verification Request | User | Secure verification link containing timed token. |
| **Password Reset** | Password Reset Request | User | Secure password reset link containing timed token. |
| **Application Confirmation** | Student Application Submission (`POST /api/v1/jobs/{id}/applications`) | Student | Job title, company name, application ID, and link to track application status. |
| **Application Status Update** | Recruiter Status Change (`PATCH /api/v1/recruiter/applications/{id}`) | Student | Transition notification (e.g. `Reviewing`, `Shortlisted`, `Accepted`, `Rejected`) with job and company details. |
| **Interview Invitation** | Recruiter Interview Scheduling (`POST /api/v1/applications/{id}/interviews`) | Student | Interview type, scheduled datetime, duration, location/meeting link, and notes. |

### Configuration & Environment Variables

| Variable | Type | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `EMAIL_PROVIDER` | string | `local` | `local` (in-memory test provider) or `smtp` (production transactional email provider). |
| `EMAIL_FROM` | string | `no-reply@careerbridge.io` | Default sender email address. |
| `EMAIL_FROM_NAME` | string | `CareerBridge` | Sender display name. |
| `SMTP_HOST` | string | `None` | Transactional SMTP server hostname. |
| `SMTP_PORT` | int | `587` | SMTP port (e.g., 587 for STARTTLS, 465 for SSL). |
| `SMTP_USERNAME` | string | `None` | SMTP authentication username. |
| `SMTP_PASSWORD` | string | `None` | SMTP authentication password. |
| `SMTP_USE_TLS` | bool | `True` | Whether to initiate STARTTLS encryption. |
| `FRONTEND_URL` | string | `http://localhost:5173` | Base URL used for constructing portal, application, and interview deep links. |

### Security & Fault-Isolation Guarantees

1. **Non-Blocking Background Delivery**: Emails are queued through FastAPI's native `BackgroundTasks` via `app.services.background_jobs.dispatch_job()`. HTTP response latency is completely decoupled from network latency or SMTP socket operations.
2. **Transactional Database Integrity**: Database mutations (such as application submission or interview creation) commit prior to background dispatch. If SMTP delivery encounters a network timeout or provider outage, the background job catches the exception and logs an error without rolling back or failing the underlying HTTP transaction.
3. **HTML Injection Defense**: User-controlled inputs (such as candidate names, job titles, or company names) are escaped via Python's standard `html.escape()` before insertion into HTML email templates.
4. **Credential & Token Protection**: Passwords, bcrypt password hashes, and raw credentials are never included in email templates or recorded in delivery logs. SMTP passwords in `SMTPEmailProvider` are masked in string representations.

---

## 19. Aggregated Role Dashboards Architecture (Phase 22)

CareerBridge delivers high-performance, real-time aggregated dashboards specifically tailored to Student, Recruiter, and Administrator personas:

```text
                  +----------------------------------------------+
                  |         React Client / AppHome Landing       |
                  |  - Role-based automatic dashboard dispatch   |
                  |  - Loading skeletons, empty & retry states   |
                  +----------------------+-----------------------+
                                         |
                                         | REST GET with Bearer JWT
                                         v
                  +----------------------------------------------+
                  |           FastAPI Dashboard Router           |
                  |  - GET /api/v1/dashboard/student (Student)   |
                  |  - GET /api/v1/dashboard/recruiter (Recruiter)|
                  |  - GET /api/v1/dashboard/admin (Admin)       |
                  +----------------------+-----------------------+
                                         |
                                         | Enforces RBAC & User Scoping
                                         v
                  +----------------------------------------------+
                  |              DashboardService                |
                  | - Database-side SQL aggregations             |
                  | - func.count, func.sum(case(...)) single-pass|
                  | - Time-window filters for upcoming interviews|
                  | - Year-scoped monthly registration grouping  |
                  +----------------------+-----------------------+
                                         |
                                         | Parameterized SQL Queries
                                         v
                  +----------------------------------------------+
                  |                  PostgreSQL                  |
                  |  (applications, jobs, interviews, users)     |
                  +----------------------------------------------+
```

### Dashboard Specifications by Role

#### 1. Student Dashboard (`GET /api/v1/dashboard/student`)
- **Access Control**: Strictly restricted to `student` role; authenticated via `require_role(UserRole.STUDENT)`.
- **Metrics Computed**:
  - `total_applications`: Count of all applications submitted by `current_user.id`.
  - `applications_under_review`: Applications in `reviewing` status.
  - `shortlisted_applications`: Applications in `shortlisted` status.
  - `accepted_applications`: Applications in `accepted` status.
  - `saved_internships`: Total bookmarked opportunities in `saved_jobs` for the student.
  - `upcoming_interviews`: Count of interviews in `scheduled` or `rescheduled` status with `scheduled_at >= now_utc`.
- **Query Strategy**: Single-pass SQL conditional aggregation over `applications` table using `func.sum(case(...))` + indexed queries for saved jobs and interviews.

#### 2. Recruiter Dashboard (`GET /api/v1/dashboard/recruiter`)
- **Access Control**: Strictly restricted to `recruiter` role; authenticated via `require_role(UserRole.RECRUITER)`.
- **Metrics Computed**:
  - `active_internships`: Count of active job postings owned by `current_user.id` (`is_active = true`).
  - `total_applications`: Total candidate applications received across all postings owned by this recruiter.
  - `applications_awaiting_review`: Applications currently in initial `applied` status.
  - `shortlisted_candidates`: Applications advanced to `shortlisted` status.
  - `scheduled_interviews`: Active interviews (`scheduled` or `rescheduled`) associated with recruiter's postings.
- **Tenant Isolation**: All queries enforce `JobPosting.recruiter_id == current_user.id`, preventing cross-organization metrics leakage.

#### 3. Administrator Dashboard (`GET /api/v1/dashboard/admin`)
- **Access Control**: Strictly restricted to `admin` role; authenticated via `require_role(UserRole.ADMIN)`.
- **Metrics Computed**:
  - `total_students`: Platform-wide count of user accounts with `role = 'student'`.
  - `total_companies`: Platform-wide count of user accounts with `role = 'recruiter'`.
  - `verified_companies`: Verified recruiter profiles (`is_verified = true`).
  - `published_internships`: Total open opportunities across the platform (`is_active = true`).
  - `total_applications`: Total application submissions across all jobs.
  - `application_success_rate`: Percentage of accepted applications (`accepted / total * 100`, protected by zero-division checks).
  - `monthly_registrations`: Array of `{ month: 'YYYY-MM', count: N }` aggregated from user registration timestamps.
- **Period/Year Filtering**: Supports optional `period_year` query parameter (`2000 <= period_year <= 2100`) to filter registration activity for specific calendar years.

### Frontend Component Architecture

1. **`AppHome.tsx`**: Dynamic landing container evaluating authentication context and rendering the appropriate dashboard view.
2. **`StudentDashboardView.tsx`**: Stat cards with status distribution, quick links to discovery/applications/interviews, empty states, and manual refresh controls.
3. **`RecruiterDashboardView.tsx`**: Pipeline summary cards, prominent "Review Queue" action alert banner for unreviewed applicants, and shortcuts to job management and scheduling.
4. **`AdminDashboardView.tsx`**: Platform KPI cards, success rate badge, interactive calendar year picker with validation, and formatted monthly registration volume list.
