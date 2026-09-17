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

- **Phase 1-5**: users
- **Phase 8-9**: students, companies
- **Phase 10-11**: internships, applications
- **Phase 13-14**: saved_internships, skills, student_skills
- **Phase 17-20**: notifications, interviews, conversations, messages, audit_logs
