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
- [ ] **Phase 4**: Alembic Migrations Configuration
- [ ] **Phase 5**: User CRUD Endpoints
- [ ] **Phase 6**: Authentication (JWT, Refresh Tokens, Password Hashing)
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
