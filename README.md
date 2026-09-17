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
- [ ] **Phase 7**: Role-Based Access Control (Student, Company, Admin)
- [ ] **Phase 8**: Student Profile & UI
- [ ] **Phase 9**: Company Profile & Verification
- [ ] **Phase 10**: Internship CRUD & Publishing
- [ ] **Phase 11**: Student Applications & Status Pipeline
- [ ] **Phase 12**: Search, Filtering, and Pagination
- [ ] **Phase 13**: Saved Internships
- [ ] **Phase 14**: Skills & Matching
- [ ] **Phase 15**: Secure File Uploads (Resumes, Photos)
- [ ] **Phase 16**: Admin Dashboard & Moderation
- [ ] **Phase 17**: Notifications
- [ ] **Phase 18**: Email Notifications
- [ ] **Phase 19**: Interview Scheduling
- [ ] **Phase 20**: Messaging (HTTP & WebSockets)
- [ ] **Phase 21**: Aggregated Role Dashboards
- [ ] **Phase 22**: Unified Error Handling & Frontend States
- [ ] **Phase 23**: End-to-End & Unit Testing
- [ ] **Phase 24**: Security Hardening & Audit
- [ ] **Phase 25**: OpenAPI / Swagger Documentation Polish
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


