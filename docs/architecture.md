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
- **Phase 11**: `applications`
- **Phase 13-14**: `saved_internships`, `skills`, `student_skills`
- **Phase 17-20**: `notifications`, `interviews`, `conversations`, `messages`, `audit_logs`

---

## 5. Domain Ownership & Security Model

CareerBridge separates identity and access into three explicit tiers:

1. **Authentication ("Who are you?")**: Verified cryptographically via `get_current_user` reading the JWT Bearer token and verifying the active account in PostgreSQL.
2. **Role Authorization ("What group do you belong to?")**: Enforced via `require_role(allowed_roles)`. Protects routes from unauthorized roles (e.g. students attempting recruiter creation/modification return `403 Forbidden`).
3. **Resource Ownership ("Do you own this specific record?")**: Strictly derived from `current_user.id`. Endpoints never accept `user_id` or `recruiter_id` from client payloads. Queries filter by `Model.user_id == current_user.id` (for profiles) or `JobPosting.recruiter_id == current_user.id` (for postings), preventing horizontal privilege escalation (IDOR) and ownership spoofing.



