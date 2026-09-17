# Student Internship Management System

A production-quality platform connecting students, companies, and administrators for end-to-end internship management. Built using **React + TypeScript**, **FastAPI**, and **PostgreSQL**.

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

	ext
student-internship-management-system/
├── backend/            # FastAPI application, SQLAlchemy models, Alembic migrations
├── frontend/           # React + TypeScript SPA built with Vite
├── docs/               # System architecture and technical documentation
│   └── architecture.md
├── .gitignore          # Git ignore rules for Python, Node, secrets, and IDEs
├── .env.example        # Environment variable template
└── README.md           # Project documentation

---

## 4. Phase Roadmap

- [x] **Phase 0**: Project Planning & Workspace Assessment
- [ ] **Phase 1**: FastAPI Foundation (Basic server, health check, docs)
- [ ] **Phase 2**: PostgreSQL Configuration & Connection
- [ ] **Phase 3**: SQLAlchemy ORM Setup & Initial User Model
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

## 5. Getting Started (Preview)

### Prerequisites
- Python 3.11+
- Node.js 18+ (Node 24 detected)
- PostgreSQL 16+

### Setup Instructions
Instructions will be expanded step-by-step as each phase is implemented.
