# CareerBridge Test Inventory and Risk Classification

**Date:** 2026-10-19
**Repository Working Copy:** `C:\CareerBridge-Safety-Copy`
**Total Backend Test Suites:** 49 files (48 root test modules + 1 dedicated safety suite in `tests/`)
**Total Frontend Test Suites:** 71 Vitest test modules + 5 Playwright E2E suites
**Audit Status:** Phase 4 Complete

---

## 1. Backend Test Classification Matrix

| Suite Name | Purpose | DB Requirement | Destructive Actions | External Deps | Risk & Classification |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `tests/test_database_testing_safety.py` | Validates DB URL parser, guard against remote hosts & protected DBs | None (Mocked) | None | None | Unit / Critical Safety Gate |
| `test_security_validator.py` | Production config gate (checks DEBUG, JWT secret entropy, DB credentials) | None | None | None | Unit / Security Gate |
| `test_rate_limiting.py` | Rate limiter window logic | None | None | None | Unit / Low Risk |
| `test_storage_provider.py` | Local vs S3 storage abstraction | None | Temporary files | Local filesystem | Unit / Low Risk |
| `test_api_documentation.py` | OpenAPI spec & docs endpoint validity | None | None | None | API / Low Risk |
| `test_validation_error_handling.py` | Pydantic error response structure | None | None | None | API / Low Risk |
| `test_auth.py` | Registration, login, JWT issuance | Live DB | Insert/Delete users | None | Integration / P0 Core |
| `test_auth_recovery.py` | Password reset tokens & workflows | Live DB | Insert/Delete tokens | None | Integration / P0 Security |
| `test_users_crud.py` | User account lifecycle & constraints | Live DB | Insert/Delete users | None | Integration / P0 Core |
| `test_user_model.py` | User ORM model & hashing | Live DB | Insert/Rollback | None | Unit/Integration |
| `test_rbac.py` | Role-based authorization boundaries | Live DB | Role verification | None | Security / P0 Core |
| `test_security.py` | Token tampering, SQL injection, CORS | Live DB | Token & DB checks | None | Security / P0 Core |
| `test_db_connection.py` | DB connectivity & health check probe | Live DB | Read current DB identity | None | Integration / Diagnostics |
| `test_health_probes.py` | Liveness, readiness, startup probes | Live DB | Read probe | None | Integration / DevOps |
| `test_admin.py` | Admin moderation & user management | Live DB | User state update | None | Integration / Admin |
| `test_student_profile.py` | Student profile CRUD | Live DB | Profile records | None | Integration / P1 Student |
| `test_recruiter_profile.py` | Recruiter profile & company verify | Live DB | Recruiter records | None | Integration / P1 Recruiter |
| `test_profile_image.py` | Avatar upload & MIME validation | Live DB | Image records & FS | Local filesystem | Integration / Media |
| `test_resume.py` | Resume upload & PDF validation | Live DB | Resume records & FS | Local filesystem | Integration / Media |
| `test_skills.py` | Taxonomy of structured skills | Live DB | Skill records | None | Integration / P1 Skills |
| `test_student_skill_compilation.py` | Skill aggregation from evidence | Live DB | Skills computation | None | Integration / P1 Skills |
| `test_job_posting.py` | Recruiter job posting CRUD | Live DB | Job records | None | Integration / P1 Jobs |
| `test_job_search.py` | Student search & filters | Live DB | Search queries | None | Integration / P1 Jobs |
| `test_saved_jobs.py` | Bookmarking jobs | Live DB | Bookmark records | None | Integration / P1 Jobs |
| `test_job_invitations.py` | Recruiter job invitation workflow | Live DB | Invitation records | None | Integration / P1 Jobs |
| `test_job_offers.py` | Job offer issuance & student decision | Live DB | Offer records | None | Integration / P1 Jobs |
| `test_opportunity_match.py` | Skill-to-job matching algorithm | Live DB | Match computation | None | Integration / Algorithm |
| `test_application.py` | Application submission & status flow | Live DB | Application records | None | Integration / P0 Core |
| `test_interviews.py` | Interview scheduling & round tracking | Live DB | Interview records | None | Integration / P1 Interview |
| `test_candidate_evaluations.py` | Recruiter candidate evaluation & scorecards | Live DB | Evaluation records | None | Integration / P1 Recruiter |
| `test_candidate_sourcing.py` | Recruiter talent pool search | Live DB | Candidate query | None | Integration / P1 Recruiter |
| `test_innovation_projects.py` | Student project portfolio CRUD | Live DB | Project records | None | Integration / P1 Projects |
| `test_project_milestones.py` | Project milestone progress tracking | Live DB | Milestone records | None | Integration / P1 Projects |
| `test_project_evidence.py` | Project evidence submission (links, repos) | Live DB | Evidence records | None | Integration / P1 Projects |
| `test_project_evidence_verification.py`| Recruiter/admin evidence verification | Live DB | Verification records| None | Integration / P1 Projects |
| `test_project_evaluations.py` | Project scorecard & rubric evaluations | Live DB | Evaluation records | None | Integration / P1 Projects |
| `test_project_blueprints.py` | Project templates & guides | Live DB | Blueprint records | None | Integration / P1 Projects |
| `test_project_recommendation_service.py`| Blueprint recommendations | Live DB | Recommender | None | Integration / P2 |
| `test_experience_records.py` | Experience Passport records | Live DB | Experience records | None | Integration / P1 Passport |
| `test_passport.py` | Public Passport & verification tokens | Live DB | Passport records | None | Integration / P1 Passport |
| `test_messaging.py` | Direct messaging & conversations | Live DB | Message records | None | Integration / P2 Chat |
| `test_websocket_messaging.py` | Real-time WebSocket chat | Live DB | WS connections | None | Integration / P2 Chat |
| `test_notifications.py` | In-app notification delivery | Live DB | Notification records| None | Integration / Notification |
| `test_email_notifications.py` | Email notification dispatcher | Live DB | Mocked email sending| None | Integration / Notification |
| `test_dashboards.py` | Analytics and dashboard stats | Live DB | Metric queries | None | Integration / Analytics |
| `test_observability.py` | Request metrics & logging | Live DB | Logging interceptors| None | Integration / Ops |
| `test_phase30b_workflows.py` | Extended project/milestone integration | Live DB | Multi-entity records| None | Integration / Phase 30B |
| `test_core_roadmap.py` | Full platform integration flow | Live DB | End-to-end entity setup| None | Integration / Critical |
| `test_migrations.py` | Alembic revision chain verification | Live DB / Alembic | Revision query | None | Integration / Schema |

---

## 2. Review of Raw SQL & Direct Cleanup Operations

Inspection of raw SQL statements across backend test modules:
1. **`backend/test_interviews.py`**:
   - Broad deletions previously present (`DELETE FROM notifications WHERE id > 0 ...`) have been removed.
   - Cleanups are strictly scoped by interview ID (`DELETE FROM interviews WHERE id IN (...)`).
2. **`backend/test_users_crud.py`**:
   - Uses `SessionLocal` from `app.core.test_database` and scoped deletions for created test users.
3. **`backend/test_security.py`**:
   - Direct SQL tests verify parameter binding against SQL injection attacks (`SELECT ... WHERE email = :email`).
   - All tests use `test_engine` and scoped transactions.
4. **`backend/app/core/test_fixtures.py` (`clean_test_records`)**:
   - Cleans records in topological order: applications -> owned jobs -> saved jobs/interviews -> notifications -> messaging -> tokens/profiles -> users.
   - Strictly scoped by explicit `user_ids` or generated unique test emails. Never executes unbounded TRUNCATE or DROP.

---

## 3. Frontend Test Classification

- **Unit & Component Tests (71 files in `src/**/__tests__/`):**
  - Framework: Vitest + React Testing Library + jsdom
  - External dependencies: Mocked via Vitest `vi.mock()`
  - Safety status: Non-destructive, in-memory execution. Safe to run in any environment.
- **End-to-End Tests (5 files in `frontend/e2e/`):**
  - Framework: Playwright
  - Requirements: Running backend server + running frontend server + test database
  - Safety status: Requires live environment; blocked until safe end-to-end infrastructure is validated.
