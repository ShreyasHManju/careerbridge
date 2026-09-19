# CareerBridge

A production-quality internship management platform connecting students, companies, and administrators. Built using **React + TypeScript**, **FastAPI**, and **PostgreSQL**.

---

## 1. Features & Roles

### Student
- Account registration, profile creation, and skill tags
- Resume & profile photo upload
- Internship discovery with search, multi-faceted filtering, and sorting
- Bookmarking / saving internships
- One-click application with unique submission enforcement
- Real-time application lifecycle tracking and withdrawal
- Interview schedule notifications and messaging

### Company
- Employer registration and verified company profiles
- Submission of verification documents for Admin review
- Comprehensive Internship Management: Draft, Publish, Edit, and Close listings
- Application tracking dashboard: Review students, shortlist candidates, manage hiring pipeline
- Interview scheduling and direct communication

### Admin
- Unified administrative dashboard
- Verification and moderation of company profiles and internship postings
- User account management and permission enforcement
- Platform analytics, metrics, and audit logging

---

## 2. Tech Stack

- **Frontend**: React, TypeScript, Vite, React Router, Axios/API client, TanStack Query, React Hook Form, Zod, Lucide Icons.
- **Backend**: Python 3.11, FastAPI, Pydantic, SQLAlchemy 2.0, Alembic, PostgreSQL.
- **Security**: Argon2/Bcrypt password hashing, JWT Access & Refresh tokens, HTTP-only cookies, strict CORS, RBAC backend dependency injection.

---

## 3. Directory Structure

```text
careerbridge/
├── backend/            # FastAPI application, SQLAlchemy models, Alembic migrations
├── frontend/           # React + TypeScript SPA built with Vite
├── docs/               # System architecture and technical documentation
│   └── architecture.md
├── .gitignore          # Git ignore rules for Python, Node, secrets, and IDEs
├── .env.example        # Environment variable template with safe placeholders
└── README.md           # Project documentation
```

---

## 4. Phase Roadmap

- [x] **Phase 0**: Project Planning & Workspace Assessment
- [x] **Phase 1**: FastAPI Foundation (Basic server, health check, docs)
- [x] **Phase 2**: PostgreSQL Configuration & Connection (PostgreSQL 16, SQLAlchemy, pydantic-settings)
- [x] **Phase 3**: SQLAlchemy ORM Setup & Initial User Model (DeclarativeBase, User model, role enum, metadata verification)
- [x] **Phase 4**: Alembic Migrations Configuration (Alembic 1.20, env.py, initial users migration, upgrade/downgrade verified)
- [x] **Phase 5**: User CRUD Endpoints (Pydantic Schemas, Bcrypt hashing, paginated CRUD API, robust validation)
- [x] **Phase 6**: Authentication & JWT Foundation (JWT access tokens, Bcrypt verification, Login endpoint, Bearer dependency, Protected /me)
- [x] **Phase 7**: Role-Based Access Control (RBAC dependencies, single/multi-role authorization, 401 vs 403 enforcement)
- [x] **Phase 8**: Student Profile & API (StudentProfile model, 1-to-1 relationship, Alembic migration, student-only RBAC, ownership enforcement)
- [x] **Phase 9**: Recruiter Profile & API (RecruiterProfile model, 1-to-1 relationship, Alembic migration, recruiter-only RBAC, ownership enforcement)
- [x] **Phase 10**: Job & Internship Posting Foundation (JobPosting model, 1-to-many relationship, Alembic migration, recruiter management, candidate discovery, RBAC)
- [x] **Phase 11**: Student Applications & Status Pipeline (Application model, DB unique constraint, student submission, recruiter review & status transitions, ownership isolation)
- [x] **Phase 12**: Search, Filtering, and Pagination (Full-text search, multi-faceted filtering, controlled sorting, offset/limit pagination)
- [x] **Phase 13**: Resume Upload & Student Document Foundation (Secure upload, PDF/DOC/DOCX validation, magic bytes, size bounds, safe replacement, download, deletion, student isolation)
- [x] **Phase 14**: Secure Student Profile Image Upload (JPEG/PNG/WebP validation, magic bytes, 2MB size limit, UUID filenames, atomic replacement, download, deletion, student isolation)
- [x] **Phase 15**: Saved Jobs & Internships (SavedJob entity, DB unique constraint on student_id + job_posting_id, save/unsave/status/list endpoints, joined queries, cascade deletion, student-only RBAC)
- [x] **Phase 16**: Admin User Management & Moderation Foundation (User search, role/status filtering, activation/deactivation, self-lockout protection, recruiter review & verification, job moderation, centralized admin RBAC)
- [x] **Phase 17**: Backend Notifications & Background Jobs Foundation (In-app notifications, read/unread tracking, bulk read-all, unread counts, real event triggers, in-memory typed background jobs abstraction)
- [x] **Phase 18**: Interviews & Interview Scheduling Foundation (Interview model, types & statuses, double-booking conflict protection, student notifications, chronological listings, soft-cancellation, RBAC & ownership)
- [x] **Phase 19**: Messaging Foundation (One-to-one conversations, message delivery, participant authorization with no admin bypass, get-or-create deduplication, read/unread tracking, notification integration)
- [x] **Phase 20**: Real-Time Messaging / WebSockets Foundation (WebSocket transport layer, WebSocketConnectionManager, query/header JWT auth, participant authorization without admin bypass, multi-tab support, real-time broadcast, read receipts, offline persistence, notification triggers)
- [x] **Phase 21**: Email Notification Foundation (Decoupled transactional email architecture, Local & SMTP providers, background jobs integration, HTML/text templates, injection escaping, failure isolation)
- [x] **Phase 22**: Aggregated Role Dashboards (High-performance database-side SQL aggregations, student/recruiter/admin summary endpoints, strict role isolation, zero frontend overhead)
- [x] **Phase 23**: Validation and Error Handling (Structured JSON error envelope, domain AppException hierarchy, standard machine-readable error codes, Pydantic & DB exception handlers, zero-leakage security shielding)
- [x] **Phase 24**: Testing Strategy (Backend Testing Only — Centralized test fixtures & factories, core roadmap suite test_core_roadmap.py, unified runner run_tests.py, 100% pass across all 23 suites)
- [ ] **Phase 25**: Security Hardening & Audit
- [ ] **Phase 26**: Docker & Docker Compose
- [ ] **Phase 27**: CI/CD Pipelines
- [ ] **Phase 28**: Production Deployment Prep
- [ ] **Phase 29**: Performance & Query Optimization
- [ ] **Phase 30**: Advanced Enhancements

---

## 5. Getting Started

### Prerequisites
- **Python**: 3.11+ (running in `backend/.venv`)
- **PostgreSQL**: Version 16.x running on port `5432`
- **Database**: `internship_db`

### 1. PostgreSQL Service Setup
Ensure the PostgreSQL 16 service is running on your machine:
```powershell
# Check service status
Get-Service -Name postgresql-x64-16

# Start service if stopped
Start-Service -Name postgresql-x64-16
```

Ensure the development database exists:
```powershell
# Connect via psql and create the database if not present
psql -U postgres -p 5432 -h localhost -c "CREATE DATABASE internship_db;"
```

### 2. Environment Configuration
Create `backend/.env` using `.env.example` as a template:
```powershell
Copy-Item .env.example backend/.env
```
Open `backend/.env` and supply your local PostgreSQL password:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_actual_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=internship_db
```
*(Note: `backend/.env` is ignored by Git and will never be committed).*

### 3. Install Backend Dependencies
Always use the virtual environment binaries:
```powershell
backend\.venv\Scripts\pip.exe install -r backend/requirements.txt
```

### 4. Verify Database Connectivity
Execute the database verification script:
```powershell
backend\.venv\Scripts\python.exe backend/test_db_connection.py
```
Expected output:
```text
[1/3] Testing Python sqlalchemy connectivity to PostgreSQL
  -> Successfully executed 'SELECT 1' ping query.
  -> Database Name: internship_db
  -> Database User: postgres
  -> Server Version: PostgreSQL 16.13
  -> Host: localhost
  -> Port: 5432
[2/3] Verifying database selection
  -> Confirmed: connected to 'internship_db'.
[3/3] All SQLAlchemy -> PostgreSQL connectivity checks PASSED SUCCESSFULLY!
```

### 5. Run the FastAPI Application
From the `backend` directory:
```powershell
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```
Or from the project root:
```powershell
backend\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 6. Verify Endpoints
- **Root**: `http://127.0.0.1:8000/` (`200 OK`)
- **Database & Service Health**: `http://127.0.0.1:8000/health` (`200 OK`, reports database connected)
- **Interactive OpenAPI Documentation**: `http://127.0.0.1:8000/docs`

---

## 6. Database Models (Phase 3)

### Initial Model: `User` (`users` table)
Defined in [`backend/app/models/user.py`](backend/app/models/user.py) using SQLAlchemy 2.0 `DeclarativeBase`:

| Column | Type | Constraints & Defaults | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `Integer` | `PRIMARY KEY`, `autoincrement=True` | Compact, high-performance sequential primary key |
| `email` | `String(255)` | `UNIQUE`, `INDEXED`, `NOT NULL` | Unique account identifier across roles |
| `password_hash` | `String(255)` | `NOT NULL` | Stored secure password hash (never plaintext) |
| `role` | `Enum(UserRole)` | `NOT NULL`, default=`student` | Supported: `student`, `recruiter`, `admin` |
| `is_active` | `Boolean` | `NOT NULL`, default=`True` | Allows deactivating suspended accounts |
| `is_verified` | `Boolean` | `NOT NULL`, default=`False` | Requires email verification or admin approval |
| `created_at` | `DateTime(tz=True)` | `NOT NULL`, `server_default=func.now()` | Authoritative UTC timestamp generated by PostgreSQL |
| `updated_at` | `DateTime(tz=True)` | `NOT NULL`, `server_default=func.now()`, `onupdate=func.now()` | Automatically updated on record modifications |

> **Note on Authentication**: Authentication routes (registration, login, JWT issuance, password hashing algorithms) are intentionally postponed to Phase 6. Establishing clean ORM modeling and database migrations first ensures the database layer is stable and testable before building authentication handlers.

### Verify User Model Metadata
Run the metadata verification test:
```powershell
backend\.venv\Scripts\python.exe backend/test_user_model.py
```

---

## 7. Database Migrations (Phase 4)

CareerBridge utilizes **Alembic** to manage database schema evolution safely, reproducibly, and under version control.

### Why Migrations?
- **Version Control for Databases**: Track exact schema changes alongside application code.
- **Team & Environment Parity**: Ensure development, staging, and production databases share identical schema states.
- **Reversible Changes**: Every migration provides both an `upgrade()` and `downgrade()` function.

### Migration Structure
- `backend/alembic.ini`: Configuration file specifying migration directory and logging. Does **not** contain raw credentials.
- `backend/alembic/env.py`: Migration environment runner. Dynamically pulls `settings.sync_database_url` and imports `Base.metadata`.
- `backend/alembic/versions/`: Contains version-controlled migration scripts.

### Common Migration Commands
Always run migration commands from the `backend` directory using the virtual environment:
```powershell
cd backend

# View current database revision
.\.venv\Scripts\alembic.exe current

# View migration history
.\.venv\Scripts\alembic.exe history --verbose

# Apply all pending migrations to head
.\.venv\Scripts\alembic.exe upgrade head

# Rollback one migration
.\.venv\Scripts\alembic.exe downgrade -1

# Generate a new auto-migration after modifying models
.\.venv\Scripts\alembic.exe revision --autogenerate -m "describe changes"
```

### Run Migration Tests
Execute the migration verification test:
```powershell
backend\.venv\Scripts\python.exe backend/test_migrations.py
```

---

## 8. User Schemas & CRUD API (Phase 5)

Phase 5 establishes the Pydantic data schemas, secure password hashing foundation, and standard development CRUD endpoints for managing `User` accounts.

### Pydantic Schemas (`backend/app/schemas/user.py`)
- **`UserCreate`**: Validates input on user registration (`email: EmailStr`, `password: str` with minimum 8 characters, optional `role: UserRole`).
- **`UserUpdate`**: Enables partial updates (`email: Optional[EmailStr]`, `role: Optional[UserRole]`, `is_active: Optional[bool]`, `is_verified: Optional[bool]`).
- **`UserResponse`**: Safe serialization response model configured with `model_config = ConfigDict(from_attributes=True)`. Returns `id`, `email`, `role`, `is_active`, `is_verified`, `created_at`, and `updated_at`. **Plaintext passwords and `password_hash` are strictly excluded from responses.**

### Password Security (`backend/app/core/security.py`)
- Standardized password hashing using `bcrypt`:
  - `hash_password(password: str) -> str`: Generates salt and hashes passwords.
  - `verify_password(plain_password: str, hashed_password: str) -> bool`: Verifies plain passwords against stored hashes.

### Endpoints (`/api/v1/users`)
| Method | Endpoint | Status Code | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/users` | `201 Created` | Creates a new user with hashed password; checks for duplicate email (`409 Conflict`). |
| `GET` | `/api/v1/users` | `200 OK` | Retrieves paginated user records via `skip` (default 0) and `limit` (default 20, max 100). |
| `GET` | `/api/v1/users/{user_id}` | `200 OK` | Retrieves a single user by primary key ID (`404 Not Found` if nonexistent). |
| `PATCH` | `/api/v1/users/{user_id}` | `200 OK` | Partially updates user properties; rejects email collision (`409 Conflict`). |
| `DELETE` | `/api/v1/users/{user_id}` | `204 No Content` | Removes user record (`404 Not Found` if nonexistent). |

> **Development-Stage Notice**: These initial CRUD endpoints are intentionally open for foundational development and verification. JWT authentication, login endpoints, refresh tokens, and role-based permissions will be layered on top during Phase 6 and Phase 7.

### Run User CRUD Verification Suite
Run the 14-point test suite covering creation, validation, password exclusion, duplication checks, pagination, updates, and deletion:
```powershell
backend\.venv\Scripts\python.exe backend/test_users_crud.py
```

---

## 9. Authentication & JWT Foundation (Phase 6)

Phase 6 implements the core authentication layer for CareerBridge, providing token-based authentication using JSON Web Tokens (JWT) and Bearer authorization.

### Authentication Architecture & Request Flow
```text
POST /api/v1/auth/login
        ↓
Pydantic LoginRequest Validation
        ↓
PostgreSQL Query: Look up User by email
        ↓
verify_password(plain, password_hash) [bcrypt]
        ↓
Verify Account Active (user.is_active == True)
        ↓
create_access_token(subject=user.id) [PyJWT HS256]
        ↓
Return TokenResponse: {"access_token": "...", "token_type": "bearer"}
```

```text
GET /api/v1/auth/me
        ↓
HTTP Header: Authorization: Bearer <access_token>
        ↓
FastAPI Dependency: get_current_user
        ↓
decode_access_token(): Validate signature + expiration
        ↓
Extract subject user ID ('sub')
        ↓
PostgreSQL Query: Retrieve active User
        ↓
Return safe UserResponse (strictly excludes password and password_hash)
```

### Endpoints (`/api/v1/auth`)
| Method | Endpoint | Status Code | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `200 OK` | Authenticates user; returns JWT Bearer access token. Returns generic `401 Unauthorized` on unknown email or incorrect password. |
| `GET` | `/api/v1/auth/me` | `200 OK` | Protected endpoint requiring valid Bearer token; returns current user's profile. |

### Security & Payload Design
- **Minimal JWT Claims**:
  - `sub`: User's primary key ID as string.
  - `exp`: Expiration UTC timestamp (defaults to 30 minutes).
  - `iat`: Issued-at UTC timestamp.
- **Data Protection**: Neither plaintext passwords nor `password_hash` are ever included in the JWT payload or API responses.
- **Generic Error Messages**: Invalid email and incorrect password return identical `401 Unauthorized` (`"Incorrect email or password"`), preventing user enumeration.
- **Account Inactivity Guard**: Inactive accounts (`is_active=False`) are blocked with `401 Unauthorized` (`"Inactive user account"`).

> **Architectural Boundary Notice**:
> Authentication (identifying who the user is) is now complete. Role-Based Access Control (RBAC - authorizing what a student, recruiter, or admin can do) and token rotation/refresh workflows will be layered on in subsequent phases.

### Run Authentication Test Suite
Execute the 16-test suite covering token generation, password verification, expiration, tampering, and protected routes:
```powershell
backend\.venv\Scripts\python.exe backend/test_auth.py
```

---

## 10. Role-Based Access Control (RBAC) (Phase 7)

Phase 7 establishes the backend authorization foundation for CareerBridge using clean, parameterized FastAPI dependency injection.

### Authentication vs. Authorization
- **Authentication ("Who are you?")**: Handled in Phase 6 via `get_current_user`. Decodes the JWT Bearer token and verifies the user exists and is active in PostgreSQL.
- **Role Authorization ("What can you do?")**: Handled in Phase 7 via `require_role(...)`. Checks if the authenticated user's role matches the required role(s) for the endpoint.
- **Resource Ownership ("Can you access THIS resource?")**: Deferred to future domain phases (e.g., student editing only their own profile, recruiter editing only their own job postings).

### Reusable RBAC Dependency (`backend/app/core/deps.py`)
```python
# Single-role protection
@router.get("/admin-only")
def admin_route(user: User = Depends(require_role(UserRole.ADMIN))):
    ...

# Multi-role protection
@router.get("/shared")
def shared_route(user: User = Depends(require_role(UserRole.STUDENT, UserRole.RECRUITER))):
    ...
```

### Status Code Semantics
- **`401 Unauthorized`**: Unauthenticated requests (missing, expired, forged, or malformed Bearer token, or inactive account). Response header: `WWW-Authenticate: Bearer`.
- **`403 Forbidden`**: Authenticated requests where the user's role lacks permission for the endpoint. Detail: `{"detail": "Not enough permissions"}`.
- **`200 OK`**: Authenticated and authorized requests.

### Source of Truth
Role evaluation relies exclusively on `current_user.role` from the PostgreSQL `users` table loaded by `get_current_user`. Roles supplied in request bodies, headers, or query parameters are never trusted.

### Demonstration Endpoints (`/api/v1/rbac`)
| Method | Endpoint | Allowed Roles | Forbidden (403) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/rbac/student` | `student` | `recruiter`, `admin` |
| `GET` | `/api/v1/rbac/recruiter` | `recruiter` | `student`, `admin` |
| `GET` | `/api/v1/rbac/admin` | `admin` | `student`, `recruiter` |
| `GET` | `/api/v1/rbac/student-or-recruiter` | `student`, `recruiter` | `admin` |

### Run RBAC Test Suite
Execute the 16-test suite covering role enforcement, cross-role blocking, multi-role routes, and error status codes:
```powershell
backend\.venv\Scripts\python.exe backend/test_rbac.py
```

---

## 11. Student Profile & Student Profile API (Phase 8)

Phase 8 introduces the first real domain entity to CareerBridge: `StudentProfile`. It connects directly to the core `User` model via a one-to-one foreign key relationship, enforcing strict ownership and role-based permissions.

### Database Architecture & Relationship
- **Table**: `student_profiles`
- **Relationship**: 1-to-1 with `users` (`user_id` is a unique foreign key referencing `users.id` with `ON DELETE CASCADE`).
- **Alembic Migration**: `a178948eff11_create_student_profiles_table.py`
- **Fields**:
  - `id`: Sequential primary key integer.
  - `user_id`: Foreign key to `users.id`, unique index `ix_student_profiles_user_id`.
  - `full_name`: Required string (2 to 100 characters).
  - `phone`, `college`, `degree`, `branch`, `graduation_year` (1900-2100), `bio`, `skills`, `github_url`, `linkedin_url`, `portfolio_url`: Optional metadata.
  - `created_at`, `updated_at`: UTC timestamps generated by PostgreSQL.

### Strict Ownership & Security Model
- **Ownership Source of Truth**: The client is never allowed to supply `user_id`. The owning `user_id` is derived strictly from `current_user.id` through the authenticated JWT Bearer token.
- **Student-Only RBAC**: Protected by `require_role(UserRole.STUDENT)`. Recruiters and Admins receive `403 Forbidden`.
- **Credential Protection**: The public schema `StudentProfileResponse` never exposes passwords or password hashes.

### Endpoints (`/api/v1/student/profile`)
| Method | Endpoint | Status Code | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/student/profile` | `200 OK` | Retrieves the profile belonging to the authenticated student (`404 Not Found` if not yet created). |
| `POST` | `/api/v1/student/profile` | `201 Created` | Creates a new profile for the student. Returns `409 Conflict` if a profile already exists. |
| `PATCH` | `/api/v1/student/profile` | `200 OK` | Partially updates fields on the student's profile (`404 Not Found` if not found). `user_id` cannot be modified. |

### Run Student Profile Test Suite
Execute the 17-test suite covering creation, retrieval, updates, duplicate prevention, RBAC enforcement, IDOR spoofing prevention, validation, and credential protection:
```powershell
backend\.venv\Scripts\python.exe backend/test_student_profile.py
```

---

## 12. Recruiter Profile & Recruiter Profile API (Phase 9)

Phase 9 introduces the second core domain entity to CareerBridge: `RecruiterProfile`. It establishes a dedicated one-to-one relationship between recruiter `User` accounts and their organization/profile metadata in PostgreSQL.

### Database Architecture & Relationship
- **Table**: `recruiter_profiles`
- **Relationship**: 1-to-1 with `users` (`user_id` is a unique foreign key referencing `users.id` with `ON DELETE CASCADE`).
- **Alembic Migration**: `823b612d228b_create_recruiter_profiles_table.py`
- **Fields**:
  - `id`: Sequential primary key integer.
  - `user_id`: Foreign key to `users.id`, unique index `ix_recruiter_profiles_user_id`.
  - `company_name`: Required string (2 to 150 characters).
  - `company_description`: Optional text overview (up to 2000 characters).
  - `contact_name`: Optional recruiter contact person name (up to 100 characters).
  - `phone`: Optional contact phone number (up to 20 characters).
  - `company_website`: Optional website URL (up to 255 characters).
  - `company_location`: Optional headquarters or office location (up to 150 characters).
  - `industry`: Optional sector classification (up to 100 characters).
  - `company_size`: Optional company size range (up to 50 characters).
  - `created_at`, `updated_at`: UTC timestamps generated by PostgreSQL.

### Strict Ownership & Security Model
- **Ownership Source of Truth**: The client cannot supply `user_id`. The owning `user_id` is derived strictly from `current_user.id` through the authenticated JWT Bearer token.
- **Recruiter-Only RBAC**: Protected by `require_role(UserRole.RECRUITER)`. Students and Admins receive `403 Forbidden`.
- **Credential Protection**: The public schema `RecruiterProfileResponse` never exposes passwords or password hashes.

### Endpoints (`/api/v1/recruiter/profile`)
| Method | Endpoint | Status Code | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/recruiter/profile` | `200 OK` | Retrieves the profile belonging to the authenticated recruiter (`404 Not Found` if not yet created). |
| `POST` | `/api/v1/recruiter/profile` | `201 Created` | Creates a new profile for the recruiter. Returns `409 Conflict` if a profile already exists. |
| `PATCH` | `/api/v1/recruiter/profile` | `200 OK` | Partially updates fields on the recruiter's profile (`404 Not Found` if not found). `user_id` cannot be modified. |

### Run Recruiter Profile Test Suite
Execute the 20-test suite covering creation, retrieval, updates, duplicate prevention, recruiter-only RBAC, IDOR isolation, validation, credential protection, and ON DELETE CASCADE purging:
```powershell
backend\.venv\Scripts\python.exe backend/test_recruiter_profile.py
```

---

## 13. Job & Internship Posting Foundation (Phase 10)

Phase 10 implements the core recruitment opportunity layer for CareerBridge: `JobPosting`. It enables recruiters to create and manage employment/internship postings while allowing candidates (students) to discover active opportunities.

### Database Architecture & Relationship
- **Table**: `job_postings`
- **Relationship**: Many-to-1 with `users` (`recruiter_id` references `users.id` with `ON DELETE CASCADE`, indexed via `ix_job_postings_recruiter_id`).
- **Alembic Migration**: `a80f62ac6bac_create_job_postings_table.py`
- **Enums**:
  - `OpportunityType`: `internship`, `job`
  - `EmploymentType`: `full_time`, `part_time`, `contract`
- **Columns**:
  - `id`: Sequential primary key integer.
  - `recruiter_id`: Foreign key referencing owning recruiter's `users.id`.
  - `title`: Required string (2 to 150 characters).
  - `description`: Required text (minimum 10 characters).
  - `opportunity_type`: Enum string (`internship`, `job`).
  - `company_name`: Required string (2 to 150 characters).
  - `location`: Optional string (up to 150 characters).
  - `is_remote`: Boolean flag (default `False`).
  - `employment_type`: Enum string (`full_time`, `part_time`, `contract`).
  - `skills`: Optional text (up to 1000 characters).
  - `minimum_qualification`: Optional string (up to 100 characters).
  - `experience_required`: Optional string (up to 50 characters).
  - `salary_min`, `salary_max`: Non-negative integers with range validation (`salary_max >= salary_min`).
  - `application_deadline`: Optional UTC timestamp.
  - `is_active`: Boolean flag (default `True`).
  - `created_at`, `updated_at`: UTC timestamps generated by PostgreSQL.

### Strict Ownership & Security Model
- **Ownership Source of Truth**: The client cannot supply `recruiter_id`. The owning `recruiter_id` is derived strictly from `current_user.id` through the authenticated JWT Bearer token.
- **Recruiter Management Protection**: Only the recruiter who created a posting can update (`PATCH`) or delete (`DELETE`) it. Cross-recruiter mutations return `403 Forbidden`.
- **Candidate Discovery & Inactive Hiding**: Candidates browsing `/api/v1/jobs` receive active postings ordered newest first. Inactive postings are strictly hidden (returning `404 Not Found` if a candidate attempts to access directly by ID).

### Endpoints (`/api/v1/jobs`)
| Method | Endpoint | Allowed Role | Status Code | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/jobs` | `recruiter` | `201 Created` | Creates a new job/internship posting bound to `current_user.id`. |
| `GET` | `/api/v1/jobs/my` | `recruiter` | `200 OK` | Lists all postings (active and inactive) owned by the authenticated recruiter. |
| `GET` | `/api/v1/jobs` | Authenticated | `200 OK` | Public discovery: Lists all active postings, ordered newest first. |
| `GET` | `/api/v1/jobs/{job_id}` | Authenticated | `200 OK` | Retrieves a single posting. Inactive postings return `404` to non-owners. |
| `PATCH` | `/api/v1/jobs/{job_id}` | `recruiter` (owner) | `200 OK` | Partially updates posting. Rejects non-owners with `403 Forbidden`. |
| `DELETE` | `/api/v1/jobs/{job_id}` | `recruiter` (owner) | `204 No Content` | Deletes posting. Rejects non-owners with `403 Forbidden`. |

### Run Job Posting Test Suite
Execute the 20-test suite covering creation, recruiter management, cross-recruiter protection, candidate discovery, inactive hiding, validation, and ownership integrity:
```powershell
backend\.venv\Scripts\python.exe backend/test_job_posting.py
```

---

## 14. Application Submission & Tracking Foundation (Phase 11)

Phase 11 implements candidate application submission and recruiter hiring lifecycle tracking: the `Application` entity and workflow. It enables students to apply for active opportunities with duplicate submission guards, while enabling recruiters to review candidate submissions and advance application stages.

### Database Architecture & Relationship
- **Table**: `applications`
- **Relationships**:
  - Many-to-1 with `job_postings` (`job_posting_id` references `job_postings.id` with `ON DELETE CASCADE`).
  - Many-to-1 with `users` (`student_id` references `users.id` with `ON DELETE CASCADE`).
- **Database Unique Constraint**:
  - `uq_job_posting_student_application`: Unique constraint on `(job_posting_id, student_id)` preventing duplicate applications at the database engine level.
- **Alembic Migration**: `faeac51e9591_create_applications_table.py`
- **Enums**:
  - `ApplicationStatus`: `applied`, `reviewing`, `shortlisted`, `rejected`, `accepted`
- **Columns**:
  - `id`: Sequential primary key integer.
  - `job_posting_id`: Foreign key referencing target `job_postings.id`.
  - `student_id`: Foreign key referencing applying student's `users.id`.
  - `status`: Lifecycle stage string enum (defaults to `applied`).
  - `cover_message`: Optional cover message text (up to 2000 characters).
  - `created_at`, `updated_at`: UTC timestamps generated by PostgreSQL.

### Strict Ownership & Security Model
- **Student Ownership Source of Truth**: The client cannot supply or modify `student_id`. It is derived strictly from `current_user.id` via the authenticated JWT token.
- **Submission Rules**:
  - Students can only apply to active jobs (`is_active == True`). Inactive jobs reject submission with `400 Bad Request`.
  - Applying to a non-existent job returns `404 Not Found`.
  - Duplicate application attempts return `409 Conflict`.
- **Recruiter Security Boundary**:
  - Recruiters may only view or update applications submitted to job postings that they own (`job_posting.recruiter_id == current_user.id`).
  - Cross-recruiter access attempts return `403 Forbidden`.
  - Recruiters cannot modify `student_id` or `job_posting_id` on applications.
- **Student Security Boundary**:
  - Students can only view their own applications via `/api/v1/applications/me` or `/api/v1/applications/{application_id}`. Cross-student detail access returns `403 Forbidden`.
  - Students cannot modify application statuses (`403 Forbidden`).

### Endpoints (`/api/v1/applications` & `/api/v1/recruiter/applications`)
| Method | Endpoint | Allowed Role | Status Code | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/jobs/{job_id}/applications` | `student` | `201 Created` | Submits application to an active job. Rejects inactive (`400`) and duplicate (`409`). |
| `GET` | `/api/v1/applications/me` | `student` | `200 OK` | Lists all applications submitted by authenticated student, ordered newest first. |
| `GET` | `/api/v1/applications/{application_id}` | `student`, `recruiter`, `admin` | `200 OK` | Retrieves application detail. Enforces ownership (`403 Forbidden` on unauthorized access). |
| `GET` | `/api/v1/recruiter/applications` | `recruiter` | `200 OK` | Lists candidate applications received across all postings owned by recruiter. |
| `GET` | `/api/v1/recruiter/applications/{application_id}` | `recruiter` (owner) | `200 OK` | Detail view for recruiter. Rejects non-owners with `403 Forbidden`. |
| `PATCH` | `/api/v1/recruiter/applications/{application_id}` | `recruiter` (owner) | `200 OK` | Updates application status (`reviewing`, `shortlisted`, `rejected`, `accepted`). |

### Run Application Test Suite
Execute the 22-test suite covering submission, RBAC boundaries, inactive checks, duplicate prevention, candidate isolation, recruiter status transitions, immutability, and cascade deletion:
```powershell
backend\.venv\Scripts\python.exe backend/test_application.py
```

---

## 15. Job Search, Filtering, and Pagination (Phase 12)

Phase 12 significantly expands the public/student-facing discovery endpoint (`GET /api/v1/jobs`) to support high-performance database-side search, multi-faceted filtering, controlled sorting, and paginated responses.

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `q` | `string` | `None` | Case-insensitive search across `title`, `description`, `company_name`, `location`, and `skills`. |
| `opportunity_type` | `OpportunityType` | `None` | Filter by opportunity category: `internship`, `job`. |
| `employment_type` | `EmploymentType` | `None` | Filter by employment type: `full_time`, `part_time`, `contract`. |
| `is_remote` | `boolean` | `None` | Filter by remote eligibility: `true`, `false`. |
| `location` | `string` | `None` | Case-insensitive partial match on job location (e.g., `Bangalore`). |
| `skills` | `string` | `None` | Case-insensitive partial match on required skills (e.g., `python`, `react`). |
| `salary_min` | `integer` (>= 0) | `None` | Minimum compensation threshold. Matches opportunities whose upper salary reaches at least this value. |
| `salary_max` | `integer` (>= 0) | `None` | Maximum compensation threshold. Matches opportunities whose starting salary is within this budget. |
| `sort_by` | `JobSortBy` | `created_at` | Field to sort by: `created_at`, `application_deadline`, `salary_min`. |
| `sort_order` | `SortOrder` | `desc` | Sort direction: `asc`, `desc`. |
| `page` | `integer` (>= 1) | `1` | Page number (1-indexed). |
| `page_size` | `integer` (1 to 100) | `10` | Number of items per page. |

### Paginated Response Schema (`JobPostingPaginationResponse`)
```json
{
  "items": [
    {
      "id": 1,
      "recruiter_id": 2,
      "title": "Senior Python Backend Engineer",
      "description": "Develop distributed cloud services using FastAPI.",
      "opportunity_type": "job",
      "company_name": "PyTech Solutions",
      "location": "Bangalore, India",
      "is_remote": false,
      "employment_type": "full_time",
      "skills": "Python, FastAPI, PostgreSQL, Redis",
      "salary_min": 60000,
      "salary_max": 90000,
      "application_deadline": "2026-11-01T00:00:00Z",
      "is_active": true,
      "created_at": "2026-09-18T10:00:00Z",
      "updated_at": "2026-09-18T10:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 10,
  "total": 37,
  "total_pages": 4
}
```

### Database & Performance Strategy
- **Database-Side Execution**: All search matching (`ILIKE`), filtering (`AND`/`OR`), counting (`COUNT()`), sorting (`ORDER BY NULLS LAST`), and pagination (`LIMIT`/`OFFSET`) execute entirely within PostgreSQL.
- **Salary Semantics**:
  - `salary_min`: Postings satisfy this requirement if `COALESCE(salary_max, salary_min) >= salary_min`.
  - `salary_max`: Postings satisfy this requirement if `COALESCE(salary_min, salary_max) <= salary_max`.
  - Undisclosed/NULL salary postings are excluded from explicit numeric salary searches.
  - Cross-validation enforces `salary_min <= salary_max` with `422 Unprocessable Entity` if violated.
- **Strict Inactive Omission**: Inactive postings (`is_active == False`) are strictly filtered out of the discovery API under all query combinations.

### Run Search & Pagination Test Suite
Execute the 28-test suite covering full search, multi-faceted filtering, salary edge cases, pagination boundary limits, sorting orders, validation rules, and security isolation:
```powershell
backend\.venv\Scripts\python.exe backend/test_job_search.py
```

---

## 16. Resume Upload & Student Document Foundation (Phase 13)

Phase 13 introduces a secure, high-performance resume and document storage subsystem for students, storing physical files on the filesystem with randomized UUID filenames and storing metadata in PostgreSQL.

### Core Architecture & Boundaries
- **Storage Location**: Local filesystem storage at `backend/uploads/resumes/`. Files are referenced by server-internal UUID filenames (e.g. `d3b07384...pdf`).
- **Database Metadata**: PostgreSQL `resumes` table records document metadata (`original_filename`, `stored_filename`, `file_path`, `content_type`, `file_size`, `created_at`, `updated_at`).
- **Strict Ownership**: Single active resume per student enforced by a unique index on `student_id` (foreign key to `users.id` with `ON DELETE CASCADE`). All endpoints strictly derive `student_id = current_user.id` from the JWT Bearer token; client payloads cannot specify or spoof user IDs.
- **Role Enforcement**: Only authenticated students (`UserRole.STUDENT`) can upload, view, download, or delete their resume. Recruiters, admins, and unauthenticated clients are blocked (401/403).

### File Validation Pipeline
1. **Extension Whitelist**: Only `.pdf`, `.doc`, and `.docx` are allowed. Executable and script extensions (`.exe`, `.bat`, `.sh`, `.py`, `.js`, etc.) trigger a 400 security violation.
2. **MIME Type Whitelist**: Strict checking against `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, and `application/octet-stream`. Invalid MIME types return `415 Unsupported Media Type`.
3. **Magic Byte Verification**: Real file signatures are checked against initial chunks to prevent extension spoofing:
   - PDF: `%PDF`
   - DOC: `\xd0\xcf\x11\xe0` (OLE2 compound header)
   - DOCX: `PK\x03\x04` (ZIP archive container header)
4. **File Size Limit**: Configurable via `MAX_RESUME_SIZE_MB=5` (default 5MB). Files are streamed in 64KB chunks to prevent memory bloat; exceeding streams are unlinked and rejected with 400.
5. **Path Traversal Guard**: Filenames are sanitized, and files are stored strictly inside the resolved `uploads/resumes/` folder using `dest_path.relative_to(base_dir)`.

### Endpoints

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/resume` | Student | Uploads or replaces resume. Returns `201 Created` with `ResumeResponse`. Cleans up old physical file upon replacement. |
| `GET` | `/api/v1/resume` | Student | Retrieves metadata for current student's resume. Returns `200 OK` (or `404 Not Found`). Excludes internal filesystem paths. |
| `GET` | `/api/v1/resume/download` | Student | Downloads physical file as `FileResponse` with original filename. Returns `200 OK` (or `404 Not Found`). |
| `DELETE` | `/api/v1/resume` | Student | Deletes resume database record and unlinks physical file. Returns `204 No Content` (or `404 Not Found`). |

### Response Schema (`ResumeResponse`)
```json
{
  "id": 1,
  "original_filename": "Jane_Doe_Resume_2026.pdf",
  "content_type": "application/pdf",
  "file_size": 145892,
  "created_at": "2026-09-18T10:00:00Z",
  "updated_at": "2026-09-18T10:00:00Z"
}
```
*Note: `file_path` and `stored_filename` are strictly hidden from public response schemas.*

### Run Resume Test Suite
Execute the 22-test suite covering valid formats, validation failures, security edge cases, replacement cleanup, download integrity, and RBAC boundaries:
```powershell
backend\.venv\Scripts\python.exe backend/test_resume.py
```

---

## 17. Secure Student Profile Image Upload (Phase 14)

Phase 14 introduces a secure, isolated profile image upload subsystem for students, storing physical images on the filesystem with randomized UUID filenames and persisting image metadata in PostgreSQL.

### Core Architecture & Boundaries
- **Storage Location**: Dedicated filesystem storage at `backend/uploads/profile_images/` (configurable via `UPLOAD_DIR` in `backend/app/core/config.py`).
- **Database Metadata**: PostgreSQL `profile_images` table records document metadata (`id`, `student_id`, `original_filename`, `stored_filename`, `file_path`, `content_type`, `file_size`, `created_at`, `updated_at`).
- **Strict Ownership**: Single active profile image per student enforced by a unique index on `student_id` (foreign key to `users.id` with `ON DELETE CASCADE`). All endpoints strictly derive `student_id = current_user.id` from the JWT Bearer token; client payloads cannot specify or spoof user IDs.
- **Role Enforcement**: Only authenticated students (`UserRole.STUDENT`) can upload, view metadata for, download, or delete their profile image. Recruiters and admins receive `403 Forbidden`. Unauthenticated requests receive `401 Unauthorized`.

### Image Validation Pipeline
1. **Allowed Extensions**: Only `.jpg`, `.jpeg`, `.png`, and `.webp` are permitted. All other formats (GIF, SVG, BMP, TIFF, ICO, PDF, DOC/DOCX, ZIP, etc.) are rejected with `400 Bad Request`.
2. **Dangerous Extensions Denylist**: Executable and script extensions (`.exe`, `.bat`, `.sh`, `.py`, `.js`, etc.) trigger a 400 security violation.
3. **MIME Type Whitelist**: Validated against `image/jpeg`, `image/png`, and `image/webp`. Other MIME types return `415 Unsupported Media Type`.
4. **Magic Byte Verification**: Real binary signatures are checked against initial bytes to prevent extension spoofing:
   - **JPEG**: Starts with `FF D8 FF` (`\xff\xd8\xff`)
   - **PNG**: Starts with `89 50 4E 47 0D 0A 1A 0A` (`\x89PNG\r\n\x1a\n`)
   - **WebP**: RIFF container with WEBP signature (`RIFF....WEBP`)
5. **File Size Limit**: Configurable via `MAX_PROFILE_IMAGE_SIZE_MB=2` (default 2MB). Images are streamed in 64KB chunks; exceeding streams are immediately unlinked from disk and rejected with 400.
6. **Path Traversal Guard**: Filenames are sanitized, server-side UUID filenames are generated (`<uuid4>.<ext>`), and storage paths are verified with `dest_path.relative_to(base_dir)`.
7. **Atomic Replacement**: On re-upload, the new image is streamed, validated, and committed to PostgreSQL before the old physical file is unlinked.

### Endpoints

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/profile-image` | Student | Uploads or replaces profile image. Returns `201 Created` with `ProfileImageResponse`. Cleans up old physical image upon replacement. |
| `GET` | `/api/v1/profile-image` | Student | Retrieves metadata for current student's profile image. Returns `200 OK` (or `404 Not Found`). Excludes internal filesystem paths. |
| `GET` | `/api/v1/profile-image/download` | Student | Downloads physical profile image file as `FileResponse`. Returns `200 OK` (or `404 Not Found`). |
| `DELETE` | `/api/v1/profile-image` | Student | Deletes profile image database record and unlinks physical file. Returns `204 No Content` (or `404 Not Found`). |

### Response Schema (`ProfileImageResponse`)
```json
{
  "id": 1,
  "original_filename": "avatar.png",
  "content_type": "image/png",
  "file_size": 84210,
  "created_at": "2026-09-18T10:00:00Z",
  "updated_at": "2026-09-18T10:00:00Z"
}
```
*Note: `file_path` and `stored_filename` are strictly hidden from public response schemas.*

### Run Profile Image Test Suite
Execute the 22-test suite covering valid formats, validation failures, security edge cases, replacement cleanup, download integrity, and RBAC boundaries:
```powershell
backend\.venv\Scripts\python.exe backend/test_profile_image.py
```

---

## 18. Phase 15: Saved Jobs / Saved Internships Subsystem

The Saved Jobs subsystem allows authenticated students to bookmark active job and internship postings, check whether an individual opportunity is saved, list their saved opportunities ordered newest-first, and remove bookmarks.

### Architectural & Security Highlights
- **Entity**: `SavedJob` mapped to PostgreSQL table `saved_jobs`.
- **Database Integrity**:
  - Unique constraint `uq_saved_job_student_job` on `(student_id, job_posting_id)` prevents duplicate bookmarks at the engine level.
  - Foreign keys to `users.id` and `job_postings.id` configured with `ondelete="CASCADE"` ensure clean cascading deletions without orphaned bookmark records.
  - Independent database indexes on `student_id` and `job_posting_id` optimize retrieval performance.
- **Strict Ownership**:
  - `student_id` is derived strictly from `current_user.id` extracted from the verified JWT Bearer token.
  - Any client-supplied `student_id` in query parameters or request bodies is discarded.
- **Role Enforcement**:
  - Restricted strictly to students (`UserRole.STUDENT`).
  - Recruiters and Admins are rejected with `403 Forbidden`.
  - Unauthenticated requests receive `401 Unauthorized`.
  - Inactive user accounts receive `401 Unauthorized`.
- **Business Logic & Validation**:
  - Only active job postings (`is_active=True`) can be saved. Attempting to save an inactive job returns `400 Bad Request`.
  - Saving a nonexistent job returns `404 Not Found`.
  - Attempting to save an already bookmarked job returns `409 Conflict`.
  - Checking save status of a nonexistent job returns `404 Not Found`.
  - Removing a bookmark that does not exist returns `404 Not Found`.
  - If a saved job is subsequently deactivated by its recruiter, it is retained in the student's saved jobs list with `is_active: false`.
- **N+1 Avoidance**: Listing saved jobs utilizes SQLAlchemy `joinedload(SavedJob.job_posting)` to fetch all required opportunity details in a single query.

### Endpoints

| Method | Endpoint | Role | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/jobs/{job_id}/save` | Student | `201 Created` | Saves/bookmarks active job. Returns `SavedJobStatusResponse`. Rejects duplicates with `409`, inactive jobs with `400`. |
| `GET` | `/api/v1/jobs/{job_id}/saved` | Student | `200 OK` | Checks if job is saved by current student. Returns `SavedJobStatusResponse`. Returns `404` if job missing. |
| `DELETE` | `/api/v1/jobs/{job_id}/save` | Student | `204 No Content` | Removes saved job bookmark. Returns `404` if bookmark not found. |
| `GET` | `/api/v1/saved-jobs` | Student | `200 OK` | Lists all saved jobs for current student, ordered newest saved first. Returns `List[SavedJobResponse]`. |

### Response Schemas

#### `SavedJobStatusResponse`
```json
{
  "job_id": 10,
  "is_saved": true,
  "saved_at": "2026-09-18T12:00:00Z"
}
```

#### `SavedJobResponse`
```json
{
  "id": 10,
  "saved_id": 1,
  "title": "Backend Engineering Intern",
  "description": "FastAPI, PostgreSQL, and distributed architecture development.",
  "opportunity_type": "internship",
  "company_name": "TechFlow Systems",
  "location": "Bengaluru, India",
  "is_remote": false,
  "employment_type": "full_time",
  "skills": "Python, FastAPI, SQL",
  "minimum_qualification": "B.Tech / B.E.",
  "experience_required": "Fresher",
  "salary_min": 30000,
  "salary_max": 45000,
  "application_deadline": "2026-10-15T00:00:00Z",
  "is_active": true,
  "created_at": "2026-09-15T10:00:00Z",
  "updated_at": "2026-09-15T10:00:00Z",
  "saved_at": "2026-09-18T12:00:00Z"
}
```

### Run Saved Jobs Test Suite
Execute the 20-test suite covering active/inactive validation, duplicate prevention, status checks, listing ordering, ownership isolation, unsave logic, RBAC, spoofing protection, and cascade deletion:
```powershell
backend\.venv\Scripts\python.exe backend/test_saved_jobs.py
```

---

## 19. Phase 16: Admin User Management & Moderation Foundation

The Admin User Management & Moderation subsystem provides platform administrators with backend capabilities to govern users, verify recruiter profiles, and moderate job postings with centralized role-based access control.

### Architectural & Security Highlights
- **Centralized Admin RBAC**: Every endpoint enforces `current_user: User = Depends(require_role(UserRole.ADMIN))` backed by verified database identities. Students and Recruiters receive `403 Forbidden`. Unauthenticated requests receive `401 Unauthorized`. Inactive accounts receive `401 Unauthorized`.
- **User Management**:
  - `GET /api/v1/admin/users`: Database-side search on email, filtering by `role` and `is_active`, ordered newest-first with pagination envelope (`page`, `page_size`, `total`, `total_pages`).
  - `GET /api/v1/admin/users/{user_id}`: Inspect individual user account metadata safely without exposing credentials.
  - `PATCH /api/v1/admin/users/{user_id}/status`: Toggle user account activity (`is_active: bool`).
- **Self-Lockout Prevention**: An administrator cannot deactivate their own currently authenticated account (`target_user.id == current_user.id and not is_active` returns `400 Bad Request`).
- **Recruiter Review & Verification**:
  - `RecruiterProfile.is_verified: bool` added to database via Alembic migration (`01b1d6a76f10`).
  - `GET /api/v1/admin/recruiters`: Search across company name, contact name, and email with `is_verified` filtering. Joined with `User` to eliminate N+1 queries.
  - `PATCH /api/v1/admin/recruiters/{user_id}/verification`: Verifies/unverifies a recruiter profile. Validates that the target user has role `RECRUITER` and has an existing `RecruiterProfile`.
- **Job Moderation**:
  - `GET /api/v1/admin/jobs`: Lists both active and inactive postings across all companies. Supports search across title, company, and location, as well as `opportunity_type`, `employment_type`, and `is_active` filtering.
  - `PATCH /api/v1/admin/jobs/{job_id}/status`: Activates or deactivates job postings without modifying ownership or listing metadata.
- **Credential Protection**: Passwords, password hashes, secrets, and JWT tokens are strictly filtered and omitted from all response schemas.

### Admin Endpoints

| Method | Endpoint | Role | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | Admin | `200 OK` | Paginated user listing with email search, role filter, and active status filter. |
| `GET` | `/api/v1/admin/users/{user_id}` | Admin | `200 OK` | Retrieves safe user metadata by ID (404 if not found). |
| `PATCH` | `/api/v1/admin/users/{user_id}/status` | Admin | `200 OK` | Activates/deactivates user account. Prevents admin self-lockout (400). |
| `GET` | `/api/v1/admin/recruiters` | Admin | `200 OK` | Lists recruiters with company info, email, search, and verification filtering. |
| `PATCH` | `/api/v1/admin/recruiters/{user_id}/verification` | Admin | `200 OK` | Verifies/unverifies a recruiter profile (400 if not recruiter, 404 if no profile). |
| `GET` | `/api/v1/admin/jobs` | Admin | `200 OK` | Lists all jobs (active & inactive) with search and opportunity/employment filters. |
| `PATCH` | `/api/v1/admin/jobs/{job_id}/status` | Admin | `200 OK` | Moderates job posting activity status (404 if not found). |

### Run Admin Test Suite
Execute the 37-test suite covering user listing, filtering, pagination, self-lockout, credential protection, recruiter review and verification, and job moderation:
```powershell
backend\.venv\Scripts\python.exe backend/test_admin.py
```

---

## 20. Phase 17: Backend Notifications & Background Jobs Foundation

The Notifications and Background Jobs subsystem provides CareerBridge with real-time in-app lifecycle updates and an extensible background task execution framework.

### Architectural & Security Highlights
- **In-App Notification Model (`notifications` table)**:
  - `user_id`: Foreign key linked to `users.id` with `ondelete="CASCADE"` and index.
  - `notification_type`: String-backed enum (`NotificationType`):
    - `application_submitted`: Triggered when an applicant submits an application.
    - `application_status_changed`: Triggered when a recruiter updates an applicant's status.
    - `recruiter_verification_changed`: Triggered when an administrator modifies recruiter verification.
    - `job_moderation_changed`: Triggered when an administrator activates or deactivates a job posting.
  - `is_read`: Boolean indicator with database index and server default `false`.
  - Composite indexes `(user_id, is_read)` and `(user_id, created_at)` for high-throughput unread counting and fast ordered pagination.
- **Strict User Ownership Isolation**:
  - All notification listing, detail, unread counts, and mutations derive recipient identity strictly from `current_user.id` (`get_current_user` dependency).
  - Attempting to mark another user's notification as read returns `404 Not Found`, eliminating horizontal privilege escalation and enumeration vectors.
- **Atomic Event Integration**:
  - Event hooks in `apply_to_job_posting`, `update_application_status`, `update_recruiter_verification`, and `update_job_status` register notification creation in the same database session, committing both state mutation and notification atomically.
- **Single-Query Bulk Operations**:
  - `PATCH /api/v1/notifications/read-all`: Updates all unread notifications for `current_user.id` in a single SQL `UPDATE` statement, preventing N+1 queries.
  - `GET /api/v1/notifications/unread-count`: Returns unread count via an optimized SQL `COUNT` query.
- **Extensible Background Job Runner (`background_jobs.py`)**:
  - Clean abstraction supporting `register_job`, `dispatch_job`, and execution history tracking.
  - Seamlessly integrates with FastAPI's `BackgroundTasks` while isolating execution errors so background failures never disrupt HTTP response pipelines.
  - Acts as a clean bridge for future message brokers (e.g. Redis, Celery) without changing caller signatures.

### Notification Endpoints

| Method | Endpoint | Role | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Any Authenticated | `200 OK` | Paginated notification listing, ordered newest first. Supports `unread_only=true`. |
| `GET` | `/api/v1/notifications/unread-count` | Any Authenticated | `200 OK` | Returns `{"unread_count": int}` for the authenticated user. |
| `PATCH` | `/api/v1/notifications/read-all` | Any Authenticated | `200 OK` | Marks all unread notifications read for the user in a single operation. |
| `PATCH` | `/api/v1/notifications/{notification_id}/read` | Any Authenticated | `200 OK` | Marks a specific user-owned notification as read (404 if not found or unowned). |

### Run Notification Test Suite
Execute the 29-test suite covering authentication, empty states, pagination, ordering, unread filtering, read mutations, cross-user and cross-role isolation, real lifecycle event triggers, cascade deletion, and background job execution:
```powershell
backend\.venv\Scripts\python.exe backend/test_notifications.py
```

---

## 21. Phase 18: Interviews & Interview Scheduling Foundation

The Interview Management & Scheduling subsystem provides recruiters and candidate students with a complete, collision-safe interview coordination pipeline.

### Architectural & Security Highlights
- **Relational Interview Model (`interviews` table)**:
  - `application_id`: Foreign key linked to `applications.id` (`ondelete="CASCADE"`).
  - `recruiter_id`: Foreign key linked to `users.id` (`ondelete="CASCADE"`).
  - `student_id`: Foreign key linked to `users.id` (`ondelete="CASCADE"`).
  - `scheduled_at`: Timezone-aware timestamp (`DateTime(timezone=True)`).
  - `duration_minutes`: Integer duration bounded between 15 and 480 minutes (8 hours).
  - `interview_type`: String-backed enum (`InterviewType`):
    - `online`: Virtual video meeting (e.g. Google Meet, Zoom).
    - `in_person`: Onsite interview at physical office/boardroom.
    - `phone`: Audio/phone screening call.
  - `location_or_link`: Optional meeting URL or physical location string (max 500 characters).
  - `notes`: Optional recruiter agenda or candidate instructions (max 2,000 characters).
  - `status`: String-backed enum (`InterviewStatus`):
    - `scheduled`: Active scheduled session.
    - `rescheduled`: Active session modified to a new timeslot.
    - `completed`: Completed interview session.
    - `cancelled`: Soft-cancelled session.
  - Indexes: individual indexes on `application_id`, `recruiter_id`, `student_id`, `scheduled_at`, `status`, plus composite indexes `(recruiter_id, scheduled_at)` and `(student_id, scheduled_at)` for high-performance conflict detection and chronological queries.
- **Double-Booking Conflict Protection**:
  - Overlap algorithm evaluates interval intersection:
    $$\text{Start}_{\text{new}} < \text{End}_{\text{existing}} \quad \text{and} \quad \text{End}_{\text{new}} > \text{Start}_{\text{existing}}$$
  - Protects **both** the recruiter and the student against conflicting simultaneous bookings across all active interviews (`scheduled`, `rescheduled`).
  - Self-exclusion logic allows updating notes or location on an existing session without triggering false positive conflicts against itself.
  - Cancelled interviews (`cancelled`) are excluded from conflict detection, immediately freeing the slot for future bookings.
- **Application Lifecycle Gatekeeping**:
  - Interviews may only be scheduled for candidates with applications in `applied`, `reviewing`, or `shortlisted` status.
  - Applications in terminal or offer states (`rejected`, `accepted`) are rejected with `400 Bad Request`.
- **Granular RBAC & Ownership Enforcement**:
  - Scheduling (`POST /applications/{id}/interviews`), updating (`PATCH /interviews/{id}`), and cancelling (`DELETE /interviews/{id}`) are strictly restricted to the authenticated recruiter who created the associated job posting (`403 Forbidden` for other recruiters or roles).
  - Interview retrieval (`GET /interviews/{id}`) is accessible only by the assigned recruiter, the candidate student, or a platform administrator.
  - Client attempts to mutate immutable relational fields (`application_id`, `recruiter_id`, `student_id`) on update are ignored.
- **Soft Cancellation Semantics**:
  - `DELETE /api/v1/interviews/{interview_id}` does not delete the database row; it transitions `status` to `cancelled`, dispatches an in-app notification to the candidate student, and releases the time slot for future scheduling.
- **Automated Lifecycle Notifications**:
  - Creating an interview emits `interview_scheduled` to the candidate student.
  - Rescheduling times/duration emits `interview_rescheduled` to the candidate student.
  - Updating notes or meeting links only preserves status and suppresses redundant notifications.
  - Cancelling an interview emits `interview_cancelled` to the candidate student.
- **Credential Hygiene**:
  - All interview responses utilize `InterviewResponse` schemas that completely exclude authentication secrets and password hashes.

### Interview Endpoints

| Method | Endpoint | Role | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/applications/{application_id}/interviews` | Recruiter | `201 Created` | Schedule an interview for an eligible candidate application with conflict checking. |
| `GET` | `/api/v1/interviews/me` | Student | `200 OK` | List candidate's scheduled interviews in chronological ascending order (`scheduled_at ASC`). |
| `GET` | `/api/v1/recruiter/interviews` | Recruiter | `200 OK` | List recruiter's scheduled interviews in chronological ascending order (`scheduled_at ASC`). |
| `GET` | `/api/v1/interviews/{interview_id}` | Recruiter / Student / Admin | `200 OK` | Retrieve detailed interview session (ownership-verified). |
| `PATCH` | `/api/v1/interviews/{interview_id}` | Recruiter | `200 OK` | Reschedule or update interview notes/link (ownership & conflict checked). |
| `DELETE` | `/api/v1/interviews/{interview_id}` | Recruiter | `200 OK` | Soft-cancel interview, releasing time slot and notifying candidate. |

### Run Interview Test Suite
Execute the 43-test suite covering authentication, RBAC, schema validation, application eligibility rules, cross-recruiter isolation, double-booking detection, soft-cancellation, chronological sorting, credential filtering, and database cascades:
```powershell
backend\.venv\Scripts\python.exe backend/test_interviews.py
```

---

## 22. Phase 19: Messaging Foundation

The Messaging subsystem provides a secure, private one-to-one communication pipeline primarily supporting interaction between students and recruiters.

### Architectural & Security Highlights
- **Relational Messaging Architecture**:
  - `conversations`: Stores one-to-one conversation sessions with normalized participant IDs (`user1_id < user2_id`).
    - Constraints: `ck_conversation_user_order` ensures canonical ID ordering; `uq_conversation_user_pair` enforces engine-level deduplication so exactly one conversation can ever exist between any two users.
    - Cascades: Deleting either user cleanly cascades to delete the conversation.
  - `conversation_participants`: Association table associating `conversation_id` and `user_id` with `uq_conversation_participant` preventing duplicate participant rows.
  - `messages`: Stores individual messages with `conversation_id`, `sender_id`, `body` (1–5000 characters), `is_read`, `created_at`, `read_at`, `updated_at`.
    - Composite indexes: `(conversation_id, created_at)` and `(conversation_id, is_read)` for high-throughput chronological retrieval and unread tracking.
- **Strict Participant Authorization (No Admin Bypass)**:
  - Private messaging is strictly confidential between the two participants.
  - Platform administrators (`UserRole.ADMIN`) cannot access conversations, read message history, send messages, or mutate read states for conversations they do not personally participate in (`403 Forbidden`).
  - Identity is derived strictly from verified JWT tokens (`current_user.id`); client-supplied sender or participant IDs are ignored.
- **Deterministic Get-or-Create Conversation**:
  - `POST /api/v1/conversations`: Accepts `other_user_id` and optional `initial_message`.
  - Validates target exists, is active, and is not the current user (self-conversations rejected with `400 Bad Request`).
  - If a conversation between the two users already exists, reuses and returns it (`200 OK`) rather than generating duplicates. Handles concurrent creation races safely via `IntegrityError` rollback.
- **Chronological Message History & Database-Side Pagination**:
  - `GET /api/v1/conversations/{id}/messages`: Returns messages in stable chronological order (`created_at ASC, id ASC`) with `page` and `page_size` bounds enforced at the query level.
- **Read / Unread State Tracking**:
  - `PATCH /api/v1/conversations/{id}/read`: Bulk marks all unread messages received by the caller as read (`is_read = true`, `read_at = now()`) in a single query.
  - Sender's own sent messages are never counted as unread for the sender.
  - `PATCH /api/v1/messages/{id}/read`: Marks an individual message as read (rejects sender attempts with `400 Bad Request`).
- **In-App Notification Integration**:
  - Dispatches `NotificationType.MESSAGE_RECEIVED` notifications to the message recipient via `NotificationService`.
  - Notification body contains a sanitized preview without exposing full message payload.
- **Real-Time Note**:
  - This phase implements the foundational HTTP REST API. Real-time WebSocket messaging is scheduled for a subsequent phase.

### Messaging Endpoints

| Method | Endpoint | Role | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/conversations` | Any Authenticated | `201 Created` / `200 OK` | Start a new conversation or retrieve existing one (deduplicated). |
| `GET` | `/api/v1/conversations` | Any Authenticated | `200 OK` | List user's conversations ordered by recent activity with unread counts. |
| `GET` | `/api/v1/conversations/{conversation_id}` | Participant Only | `200 OK` | Retrieve single conversation details. |
| `POST` | `/api/v1/conversations/{conversation_id}/messages` | Participant Only | `201 Created` | Send a message and dispatch notification to recipient. |
| `GET` | `/api/v1/conversations/{conversation_id}/messages` | Participant Only | `200 OK` | List messages chronologically with database-side pagination. |
| `PATCH` | `/api/v1/conversations/{conversation_id}/read` | Participant Only | `200 OK` | Mark all received messages in conversation as read. |
| `PATCH` | `/api/v1/messages/{message_id}/read` | Recipient Only | `200 OK` | Mark single received message as read. |

### Run Messaging Test Suite
Execute the 47-test suite covering authentication, conversation lifecycle, duplicate reuse, participant authorization, message delivery, pagination, read states, notifications, security, and cascades:
```powershell
backend\.venv\Scripts\python.exe backend/test_messaging.py
```

---

## 23. Phase 20: Real-Time Messaging / WebSockets Foundation

The Real-Time Messaging transport layer provides instantaneous two-way event synchronization over WebSockets (`WS /api/v1/ws/conversations/{conversation_id}`). It builds directly upon the Phase 19 HTTP messaging foundation, preserving PostgreSQL persistence, participant authorization, and in-app notifications.

### Architectural & Transport Highlights
- **WebSocket Endpoint**:
  - `WS /api/v1/ws/conversations/{conversation_id}`
  - Accessible via query parameter authentication (`?token=<jwt_access_token>`) or headers (`Authorization: Bearer <jwt>` / `Sec-WebSocket-Protocol: <jwt>`).
- **Connection Handshake Authentication & Authorization**:
  - Validates token signature, expiration, and user active status.
  - Checks conversation existence and verifies participant authorization (`user1_id` or `user2_id`).
  - Strict participant rule: **No Admin bypass**. Admins attempting to connect to private conversations where they are not an explicit participant are rejected during handshake with `1008 Policy Violation`.
  - Non-existent conversations, missing tokens, invalid tokens, or unauthorized users are rejected with `1008 Policy Violation`.
- **In-Memory Connection Manager (`WebSocketConnectionManager`)**:
  - Fast, thread-safe, and asynchronous socket tracking mapped by `conversation_id -> user_id -> set[WebSocket]`.
  - **Multi-Tab Support**: A user can open multiple concurrent tabs or devices; all active sockets receive real-time events.
  - **Dead Socket Pruning**: Stale or broken connections are automatically detected and pruned during broadcast without interrupting other clients.
  - Automatic pruning of empty conversation and user entries prevents memory leaks.
- **Bi-Directional JSON Message Protocol**:
  - **Inbound Events**:
    - `{"type": "message", "body": "..."}`: Validates message text (non-empty, max 5000 chars), derives `sender_id` strictly from authenticated JWT claims, persists to PostgreSQL via `MessagingService.send_message`, creates an in-app notification for the recipient, and broadcasts to active conversation sockets.
    - `{"type": "read"}`: Marks all unread messages received by the user in this conversation as read in PostgreSQL and broadcasts a `messages_read` receipt.
    - `{"type": "ping"}`: Lightweight heartbeat returning `{"type": "pong"}`.
  - **Outbound Events**:
    - `{"type": "new_message", "message": {...}}`: Sent to both participants (with ISO 8601 timestamps, sender email, and `is_read = false`).
    - `{"type": "messages_read", "conversation_id": 1, "reader_id": 2, "read_at": "..."}`: Read receipts for bulk mark-read.
    - `{"type": "message_read", "conversation_id": 1, "message_id": 5, "reader_id": 2, "read_at": "..."}`: Read receipt for single message read.
    - `{"type": "error", "code": "...", "message": "..."}`: Structured error responses (`INVALID_MESSAGE`, `MESSAGE_TOO_LONG`, `MALFORMED_JSON`, `UNSUPPORTED_EVENT`).
- **Offline Delivery & Notification Continuity**:
  - Messages sent while the recipient is offline are safely committed to PostgreSQL with `is_read = false`.
  - Recipient receives an in-app notification (`NotificationType.MESSAGE_RECEIVED`) and can retrieve full history via HTTP `GET /api/v1/conversations/{id}/messages` when logging back in.
- **HTTP & WebSocket Synchronization**:
  - Sending messages via HTTP `POST /api/v1/conversations/{id}/messages` automatically broadcasts to any active WebSocket listeners.
  - Marking messages read via HTTP `PATCH /api/v1/conversations/{id}/read` or `PATCH /api/v1/messages/{id}/read` automatically broadcasts read receipts to active WebSocket listeners.

### WebSocket Endpoints

| Protocol | Endpoint | Auth Mechanism | Authorization | Description |
| :--- | :--- | :--- | :--- | :--- |
| `WS` | `/api/v1/ws/conversations/{conversation_id}` | `?token=<jwt>` / `Authorization` header | Participant Only (No Admin Bypass) | Real-time bi-directional conversation exchange, broadcast, and read receipts. |

### Run Real-Time Messaging Test Suite
Execute the 48-test suite covering authentication, authorization, multi-tab lifecycles, validation, persistence, real-time broadcasts, read states, notifications, and security:
```powershell
backend\.venv\Scripts\python.exe backend/test_websocket_messaging.py
```

---

## 24. Phase 21: Email Notification Foundation

CareerBridge implements a robust, asynchronous transactional email foundation designed to notify students and recruiters about critical lifecycle events while maintaining total database failure isolation and zero external message broker dependencies.

### Key Capabilities & Architectural Highlights
- **Pluggable Provider Architecture (`BaseEmailProvider`)**:
  - `LocalEmailProvider`: In-memory development and test provider capturing emails with zero third-party dependencies. Includes inspection (`get_sent_emails`, `get_last_email`) and safe resetting (`clear`).
  - `SMTPEmailProvider`: Standard transactional SMTP delivery leveraging Python's built-in `smtplib` and `email.message.EmailMessage`, with configurable STARTTLS, authentication, and error wrapping.
  - `get_email_provider()`: Factory switching between providers via `EMAIL_PROVIDER` setting (`"local"` or `"smtp"`).
- **Asynchronous & Decoupled Execution**:
  - Leverages CareerBridge's existing in-memory background job framework (`background_jobs.py`) and FastAPI's `BackgroundTasks`.
  - HTTP endpoints dispatch jobs non-blockingly and return responses immediately.
  - Failures in email dispatch or network connectivity are trapped in `_execute_job_safe`, recorded to execution history with `"status": "failed"`, and **never** roll back primary database transactions or abort user-facing requests.
- **Supported Notification Events**:
  1. **Welcome Email** (`EmailEventType.WELCOME`): Dispatched upon successful user account creation (`POST /api/v1/users`). Contains account role and dashboard access link. Strictly omits plaintext passwords and hashes.
  2. **Email Verification** (`EmailEventType.EMAIL_VERIFICATION`): Foundational template and service interface delivering secure verification links.
  3. **Password Reset** (`EmailEventType.PASSWORD_RESET`): Foundational template and service interface delivering time-sensitive password recovery links.
  4. **Application Confirmation** (`EmailEventType.APPLICATION_CONFIRMATION`): Dispatched to the applying student upon submitting an application (`POST /api/v1/jobs/{job_id}/applications`).
  5. **Application Status Update** (`EmailEventType.APPLICATION_STATUS_UPDATE`): Dispatched to the applicant student when a hiring recruiter modifies pipeline status (`PATCH /api/v1/recruiter/applications/{id}`). Protected against redundant dispatches when status is unchanged.
  6. **Interview Invitation** (`EmailEventType.INTERVIEW_INVITATION`): Dispatched to candidate students upon interview scheduling (`POST /api/v1/applications/{id}/interviews`), providing time, type, duration, link, and notes.
- **Security & Injection Prevention**:
  - Dual-format templates (plain text `.txt` and responsive HTML `.html`) in `backend/app/templates/email/`.
  - HTML escaping with `html.escape()` protects all interpolated user parameters against HTML injection and cross-site scripting (XSS).
  - Recipient emails are strictly derived from authenticated server entities (e.g. `user.email`, `application.student.email`), never accepting unauthenticated client-provided recipient parameters.
  - **No Email Flooding**: One-to-one conversation messages and WebSockets strictly do NOT trigger email notifications.
  - Credentials, database connection strings, and JWT secrets are strictly masked and absent from logs and email content.

### Configuration (`.env` / `config.py`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `EMAIL_PROVIDER` | `"local"` | Email delivery engine: `"local"` (in-memory) or `"smtp"` |
| `EMAIL_FROM` | `"no-reply@careerbridge.io"` | Default sender email address |
| `EMAIL_FROM_NAME` | `"CareerBridge"` | Sender display name |
| `SMTP_HOST` | `None` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USERNAME` | `None` | SMTP authentication username |
| `SMTP_PASSWORD` | `None` | SMTP authentication password |
| `SMTP_USE_TLS` | `True` | Enable STARTTLS for SMTP connections |
| `FRONTEND_URL` | `"http://localhost:5173"` | Base frontend URL for links |

### Run Email Notification Test Suite
Execute the 43-test suite covering providers, templates, background jobs, HTML escaping, and end-to-end API workflows:
```powershell
backend\.venv\Scripts\python.exe backend/test_email_notifications.py
```

---

## 25. Phase 22: Aggregated Role Dashboards

CareerBridge provides production-grade, database-aggregated summary dashboards tailored for each platform role: **Student**, **Recruiter / Company**, and **Administrator**. Engineered to eliminate the need for loading, parsing, and aggregating raw tabular data in the browser or mobile application, all metrics are computed server-side in PostgreSQL using optimized conditional SQL aggregations.

### Key Capabilities & Architectural Highlights
- **Server-Side SQL Aggregation**:
  - Leverages PostgreSQL's `COUNT()`, `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`, and `COALESCE()` to compute multi-metric breakdowns in a single query pass.
  - Zero heavy records or raw lists sent to the frontend; response payloads are tiny, constant-time JSON objects.
- **Strict Role Boundaries & Ownership Isolation**:
  - `GET /api/v1/dashboard/student`: Requires `UserRole.STUDENT`. Data is strictly restricted to records where `student_id == current_user.id`.
  - `GET /api/v1/dashboard/recruiter`: Requires `UserRole.RECRUITER`. Postings, application reviews, and scheduled interviews are strictly restricted to opportunities owned by `JobPosting.recruiter_id == current_user.id`.
  - `GET /api/v1/dashboard/admin`: Requires `UserRole.ADMIN`. Aggregates platform-wide ecosystem metrics, active listings, verified partner counts, and growth analytics.
  - Cross-role requests return `403 Forbidden`. Unauthenticated requests return `401 Unauthorized`.
  - **No Admin Bypass**: Administrators cannot spy on private student or recruiter dashboards via these endpoints, ensuring absolute privacy boundaries.
- **Aggregated Metric Definitions**:
  - **Student Dashboard (`StudentDashboardResponse`)**:
    - `total_applications`: Count of all applications submitted by this student.
    - `applications_under_review`: Applications currently in `reviewing` status.
    - `shortlisted_applications`: Applications advanced to `shortlisted` status.
    - `accepted_applications`: Applications that have been marked `accepted`.
    - `saved_internships`: Number of bookmarked opportunities currently saved by this student.
    - `upcoming_interviews`: Scheduled or rescheduled interviews where `scheduled_at >= NOW()` (excludes past, completed, and cancelled interviews).
  - **Recruiter Dashboard (`RecruiterDashboardResponse`)**:
    - `active_internships`: Number of currently published/active opportunities owned by this recruiter (`is_active = true`).
    - `total_applications`: Total candidate applications received across all postings owned by this recruiter.
    - `applications_awaiting_review`: Applications pending initial review (`status = 'applied'`).
    - `shortlisted_candidates`: Candidates advanced to `shortlisted` status across recruiter's listings.
    - `scheduled_interviews`: Scheduled or rescheduled interviews associated with the recruiter's listings.
  - **Admin Dashboard (`AdminDashboardResponse`)**:
    - `total_students`: Total user accounts with the student role.
    - `total_companies`: Total user accounts with the recruiter role.
    - `verified_companies`: Number of recruiter organizations verified by administrators.
    - `published_internships`: Total active/published opportunities currently open across the platform.
    - `total_applications`: Total application submissions across all platform postings.
    - `application_success_rate`: Percentage of total applications that achieved acceptance (`(accepted / total) * 100`), safely handling zero total submissions without division errors.
    - `monthly_registrations`: List of `{"month": "YYYY-MM", "count": N}` objects for the current calendar year (or filtered by optional `period_year` query parameter).

### Dashboard Endpoints

| Method | Endpoint | Allowed Role | Response Model | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/student` | `student` | `StudentDashboardResponse` | Aggregated application, bookmark, and upcoming interview counts for authenticated student. |
| `GET` | `/api/v1/dashboard/recruiter` | `recruiter` | `RecruiterDashboardResponse` | Active postings, incoming application breakdown, and scheduled interviews for recruiter's jobs. |
| `GET` | `/api/v1/dashboard/admin` | `admin` | `AdminDashboardResponse` | Platform-wide KPIs, company verification counts, application success rate, and monthly registrations. |

### Run Dashboard Test Suite
Execute the 31-test suite covering security, RBAC enforcement, SQL aggregation accuracy, data isolation, empty states, and performance SLAs:
```powershell
backend\.venv\Scripts\python.exe backend/test_dashboards.py
```

---

## 26. Phase 23: Validation & Error Handling Architecture

CareerBridge incorporates a centralized, production-grade validation and error handling architecture across the entire FastAPI backend. It guarantees that every error condition—including Pydantic input validation failures, JWT authentication and RBAC issues, resource ownership violations, database integrity conflicts, and unexpected server errors—returns a uniform, structured JSON response envelope while protecting backend implementation details, database internals, and stack traces.

### Uniform JSON Error Envelope

Every HTTP error response (4xx, 5xx) strictly conforms to the standard CareerBridge error schema:
```json
{
  "success": false,
  "message": "Human-readable summary of the error.",
  "error_code": "MACHINE_READABLE_ERROR_CODE",
  "detail": "Detailed context or list of field validation errors"
}
```

- **`success`** (`bool`): Always `false` on any non-2xx status response.
- **`message`** (`str`): Clear, human-readable summary.
- **`error_code`** (`str`): Standard, uppercase machine-readable code enabling programmatic frontend error handling.
- **`detail`** (`Any`): Context-specific detail (string, list of Pydantic validation errors, or dict) preserving 100% backward compatibility with standard FastAPI clients and tests.

### Standard Machine-Readable Error Codes

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `422` | Request body, query parameter, or path parameter failed Pydantic schema validation. |
| `AUTHENTICATION_REQUIRED` | `401` | Missing, malformed, or missing Bearer token in authorization header. |
| `INVALID_TOKEN` | `401` | JWT signature is invalid, decode failed, or token is corrupt. |
| `TOKEN_EXPIRED` | `401` | JWT expiration timestamp has elapsed. |
| `FORBIDDEN` | `403` | User lacks required role, verification status, or permissions. |
| `RESOURCE_OWNERSHIP_ERROR` | `403` | Cross-user tampering: user attempted to modify or delete a resource owned by someone else. |
| `NOT_FOUND` | `404` | Target resource, entity, or URL route does not exist. |
| `DUPLICATE_APPLICATION` | `409` | Student has already submitted an active application for this job posting. |
| `RESOURCE_CONFLICT` | `409` | Unique constraint violation or conflicting concurrent database operation. |
| `CONFLICTING_INTERVIEW` | `409` | Double-booking conflict for the student or recruiter at the requested time slot. |
| `INVALID_STATE` | `400` | Attempted lifecycle state transition is illegal or target entity is inactive. |
| `FILE_TOO_LARGE` | `400` | Uploaded resume or profile image exceeds size limit (5MB for resumes, 2MB for images). |
| `INVALID_FILE_TYPE` | `400` | File MIME type or magic bytes header is not permitted. |
| `BAD_REQUEST` | `400` | Malformed request or client-side syntax error. |
| `INTERNAL_SERVER_ERROR` | `500` | Unhandled server exception, sanitized to prevent information disclosure. |

### Core Exception Hierarchy (`app.core.exceptions`)

All domain exceptions inherit from the base `AppException`:
- `AppException(message, error_code, status_code, detail, headers)`
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

### Security & Information Disclosure Shielding
- **Database Internals Shielded**: `IntegrityError` and `SQLAlchemyError` exceptions escaping route handlers are intercepted. Raw SQL statements, table names, primary/foreign key names, and PostgreSQL error numbers are stripped. Safe messages (`"A resource with these details already exists."`) and structured error codes (`RESOURCE_CONFLICT`) are returned.
- **Zero Stacktrace Leakage**: Unhandled server exceptions (`Exception`) return HTTP 500 with a generic message (`"An unexpected internal server error occurred."`) and `INTERNAL_SERVER_ERROR` code. Python tracebacks, module paths, line numbers, and file paths are strictly logged server-side and never emitted in client responses.
- **Credential Protection**: Passwords, bcrypt hashes, JWT secret keys, and database connection strings are never reflected in error payloads.

### Run Validation & Error Handling Test Suite
Execute the 19-test suite covering standard error envelopes, domain exceptions, Pydantic validations, database integrity constraints, and security shielding:
```powershell
backend\.venv\Scripts\python.exe backend/test_validation_error_handling.py
```

---

## 27. Phase 24: Backend Testing Strategy & Architecture

CareerBridge incorporates a unified, repeatable, and scalable backend testing architecture. Designed to strictly validate every backend layer—from core ORM models and migrations to HTTP endpoints, real-time WebSockets, background jobs, and error envelopes—the testing strategy guarantees comprehensive test coverage, strict database isolation, and deterministic repeatability without cross-suite pollution.

### 1. Centralized Test Fixtures & Factories (`app.core.test_fixtures`)

The backend testing layer provides standardized, leak-free test fixtures and entity factories in [`backend/app/core/test_fixtures.py`](backend/app/core/test_fixtures.py):
- **`get_test_db()`**: Context manager yielding a dedicated `SessionLocal(expire_on_commit=False)` with guaranteed auto-commit, automatic rollback on unhandled exceptions, and guaranteed connection teardown.
- **`generate_test_email(prefix)`**: Produces millisecond-timestamped, random-suffix emails (e.g. `user_1789796135527_dc823e@careerbridge.io`) to eliminate any chance of collision across concurrent or sequential test executions.
- **`create_test_user(db, role, ...)`**: Factory generating valid users with bcrypt-hashed passwords and corresponding `StudentProfile` or `RecruiterProfile` entities.
- **`get_auth_headers(user)`**: Generates authentic, signed JWT Bearer authorization headers (`{"Authorization": "Bearer <token>"}`) for authenticated requests.
- **`create_test_job(db, recruiter_id, ...)`**: Factory generating valid, configurable `JobPosting` records.
- **`create_test_application(db, student_id, job_posting_id, ...)`**: Factory generating valid `Application` records with status tracking.
- **`clean_test_records(db, user_ids, emails)`**: Comprehensive teardown helper that deletes entities and dependent child records in strict topological foreign-key order (interviews, applications, saved jobs, notifications, messages, participants, files, profiles, and users).

### 2. Core Roadmap Test Coverage (`test_core_roadmap.py`)

A dedicated comprehensive test suite directly verifies all 10 core requirements specified in the original engineering roadmap:
1. **Registration**: Valid registration returns 201, invalid payloads return 422 `VALIDATION_ERROR`, duplicate emails return 400/409, passwords are encrypted with bcrypt, and passwords/hashes are never exposed in responses.
2. **Login**: Valid credentials yield JWT access tokens, wrong passwords return 401 `AUTHENTICATION_REQUIRED`, unknown users return 401, inactive accounts cannot authenticate, and token responses omit credentials.
3. **Password Hashing**: Bcrypt salt randomness verified (unique hash per call), verification correctness verified, and plaintext storage strictly prohibited.
4. **Role Permissions**: Role authorization matrix enforced across Student, Recruiter, and Admin roles; unauthenticated access returns 401; wrong-role access returns 403 `FORBIDDEN`.
5. **Internship / Job Creation**: Recruiter can create postings (201), non-recruiters blocked (403), inverted salary ranges rejected (422), and recruiter ownership immutably enforced.
6. **Internship / Job Filtering**: Full-text and keyword search (`?q=...`), multi-criteria filtering (opportunity_type, employment_type, location, remote, salary), pagination (`page`, `size`), and inactive postings strictly hidden from student discovery.
7. **Application Submission**: Valid student can submit applications (201), non-students blocked (403), submissions to inactive jobs rejected (400), submissions to non-existent jobs return 404 `NOT_FOUND`.
8. **Duplicate Application Prevention**: Repeated submissions by the same student to the same job return 409 `DUPLICATE_APPLICATION` / `RESOURCE_CONFLICT`, and database unique constraints guarantee that no duplicate row is created.
9. **Application Status Changes**: Owning recruiter can advance status (`applied` -> `reviewing` -> `shortlisted` -> `accepted`), unauthorized recruiters and students blocked (403), and student can observe updated status.
10. **Admin Permissions**: Admin endpoints strictly require admin role; students and recruiters return 403; admin recruiter verification and job moderation work; admin self-lockout deactivation blocked with 400.
11. **Structured Error Handling & Shielding**: Error responses for 401, 403, 404, 409, 422, and 500 conform to the standard JSON envelope (`{"success": false, "message": "...", "error_code": "...", "detail": ...}`) with zero tracebacks, zero SQL statements, and zero credential leakage.

### 3. Unified Backend Test Runner (`run_tests.py`)

CareerBridge provides a centralized test runner script [`backend/run_tests.py`](backend/run_tests.py) to execute the complete platform test suite:
```powershell
# Run the complete test suite (all 23 suites)
backend\.venv\Scripts\python.exe backend/run_tests.py

# Run a specific test suite
backend\.venv\Scripts\python.exe backend/run_tests.py test_core_roadmap.py

# Run multiple test suites with verbose output
backend\.venv\Scripts\python.exe backend/run_tests.py test_auth test_rbac -v
```

### 4. Complete Backend Test Suite (23 / 23 Passing)

| # | Test Suite | Scope & Category | Status |
| :- | :--- | :--- | :--- |
| 1 | `test_admin.py` | Admin user management, recruiter verification, job moderation | **PASS** |
| 2 | `test_application.py` | Application submissions, status pipeline, cross-user isolation | **PASS** |
| 3 | `test_auth.py` | Authentication, JWT issuance, token expiration, /me endpoint | **PASS** |
| 4 | `test_core_roadmap.py` | Comprehensive core roadmap requirements (16 test scenarios) | **PASS** |
| 5 | `test_dashboards.py` | SQL aggregated role dashboards (Student, Recruiter, Admin) | **PASS** |
| 6 | `test_db_connection.py` | PostgreSQL connectivity, ping checks, session management | **PASS** |
| 7 | `test_email_notifications.py` | Email provider abstraction, background jobs, HTML escaping | **PASS** |
| 8 | `test_interviews.py` | Interview scheduling, slot conflicts, status lifecycle | **PASS** |
| 9 | `test_job_posting.py` | Recruiter job CRUD, salary validations, ownership binding | **PASS** |
| 10 | `test_job_search.py` | Multi-faceted search, filtering, sorting, pagination | **PASS** |
| 11 | `test_messaging.py` | 1-to-1 conversations, message delivery, participant RBAC | **PASS** |
| 12 | `test_migrations.py` | Alembic migration heads, schema integrity, table indexes | **PASS** |
| 13 | `test_notifications.py` | In-app notifications, unread counts, bulk read operations | **PASS** |
| 14 | `test_profile_image.py` | Profile image upload, magic bytes, dimensions, replacement | **PASS** |
| 15 | `test_rbac.py` | Role-based access control, dependency authorization matrix | **PASS** |
| 16 | `test_recruiter_profile.py` | Recruiter organizational metadata, verification flags | **PASS** |
| 17 | `test_resume.py` | Resume upload, PDF/DOC/DOCX validation, download, deletion | **PASS** |
| 18 | `test_saved_jobs.py` | Saved jobs bookmarks, unique constraints, status queries | **PASS** |
| 19 | `test_student_profile.py` | Student profile CRUD, educational metadata, skill arrays | **PASS** |
| 20 | `test_user_model.py` | SQLAlchemy User model metadata, column constraints, defaults | **PASS** |
| 21 | `test_users_crud.py` | User account registration, listing, pagination, validations | **PASS** |
| 22 | `test_validation_error_handling.py` | Centralized structured error envelopes, domain exceptions | **PASS** |
| 23 | `test_websocket_messaging.py` | Real-time WebSocket connection manager, auth, broadcast | **PASS** |



