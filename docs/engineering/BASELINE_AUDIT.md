# CareerBridge Baseline and Repository Audit

**Date:** 2026-10-19
**Repository Working Copy:** `C:\CareerBridge-Safety-Copy`
**Original Repository (Untouched):** `C:\Users\HP\OneDrive\Desktop\CareerBridge`
**Audit Status:** Phase 1 Complete — Evidence-Based Record

---

## 1. Repository and Git Identification

| Item | Observed Value | Evidence Source |
| :--- | :--- | :--- |
| **Working Root** | `C:\CareerBridge-Safety-Copy` | `git rev-parse --show-toplevel` |
| **Active Branch** | `integrate-careerbridge-redesign` | `git branch -vv` |
| **Head Commit** | `beb86dc` (`fix(security): reject development secrets in production`) | `git log -1` |
| **Tracking Status** | Ahead of `origin/integrate-careerbridge-redesign` by 2 commits (`beb86dc`, `e0838c5`) | `git branch -vv` |
| **Working Tree Status** | 51 modified files, 4 untracked paths | `git status --short` |
| **Staged Changes** | None (0 staged) | `git status --short` |

### Untracked Files Inventory
- `backend/app/core/test_database.py` (Isolated test database engine and validator)
- `backend/tests/` (Contains non-database unit tests `test_database_testing_safety.py`)
- `docker-compose.phase40c.yml` (Preserved user work — protected from deletion/overwrite)
- `docker-compose.test.yml` (Isolated test compose config referencing `careerbridge-isolated-test-db`)

### Modified Files Summary (51 files)
- Configuration & Migrations: `.env.example`, `backend/.env.example`, `backend/alembic/env.py`
- Test Framework Core: `backend/conftest.py`, `backend/run_tests.py`, `backend/app/core/test_fixtures.py`
- Data Model: `backend/app/models/project_evaluation.py` (removed duplicate `index=True` on ForeignKey columns)
- Backend Test Modules (44 files): Updated imports from `app.core.database` (`SessionLocal`, `engine`) to `app.core.test_database` to ensure fail-closed test database routing.

---

## 2. Project Architecture and Component Analysis

### A. Backend Architecture
- **Framework:** FastAPI (`>=0.115.0, <1.0.0`), Uvicorn standard
- **Language / Runtime:** Python 3.11.9
- **Data Validation & Settings:** Pydantic v2 (`>=2.8.0, <3.0.0`), `pydantic-settings`
- **ORM & Database Drivers:** SQLAlchemy 2.0 (`>=2.0.0, <3.0.0`), `psycopg[binary]` v3, `psycopg2-binary`
- **Migrations:** Alembic (`>=1.13.0, <2.0.0`)
- **Security & Auth:** PyJWT, bcrypt, `email-validator`, Google Auth (`google-auth`)
- **Storage:** AWS S3 (`boto3`) and local file fallback
- **Test Framework:** `pytest` (9.1.1 installed locally; requirements specify `>=8.0.0, <10.0.0`), `httpx` (Starlette TestClient)

### B. Frontend Architecture
- **Framework:** React 18.3.1, React DOM 18.3.1
- **Build Tooling:** Vite 5.4.6, `@vitejs/plugin-react` 4.3.1
- **Language:** TypeScript 5.5.4
- **Routing:** React Router DOM 6.26.2
- **Auth & HTTP:** `@react-oauth/google` 0.13.5, Axios 1.7.7
- **Unit & Component Testing:** Vitest 2.1.1, jsdom 25.0.0, `@testing-library/react` 16.0.1, `@testing-library/jest-dom` 6.5.0
- **E2E Testing:** `@playwright/test` 1.63.0 (`playwright.config.ts`)

### C. Database and Migration Tooling
- **Engine:** PostgreSQL 16
- **Migration Head:** `b8c9d0e1f2a3` (`create_password_reset_tokens_table`)
- **Total Migrations:** 31 version files in `backend/alembic/versions/`
- **Migration Status:** Single head, linear dependency chain

### D. Docker and Deployment Configuration
- `Dockerfile` (Backend): Multi-stage or direct Python 3.11 image running Uvicorn.
- `Dockerfile` (Frontend): Multi-stage build with Nginx serving static assets.
- `docker-compose.yml`: Default development configuration.
- `docker-compose.production.yml`: Production services configuration.
- `docker-compose.tunnel.yml`: Cloudflare tunnel deployment overlay.
- `docker-compose.phase40c.yml`: Staging deployment setup (preserved, untracked).
- `docker-compose.test.yml`: Ephemeral test database compose configuration.

### E. CI/CD Workflows
- `.github/workflows/ci.yml`: Full push/PR CI checking backend migrations, pytest, and frontend tests.
- `.github/workflows/backend-ci.yml`: Backend-focused test runner.
- `.github/workflows/frontend-ci.yml`: Frontend build and Vitest execution.
- `.github/workflows/e2e-ci.yml`: Playwright end-to-end suite runner.

### F. Security Checks
- `app/core/security_validator.py`: Production configuration security gate checking:
  - DEBUG mode disabled in production
  - JWT secret entropy and blocklist of default/insecure keys
  - Non-default PostgreSQL credentials
  - Approved CORS origins
  - S3 storage bucket configuration
- `backend/test_security_validator.py`: 420-line test suite validating security gate defenses.
- `backend/test_security.py`: Tests for token validation, password hashing, and rate limiting.

### G. Existing Documentation
- `docs/architecture.md`: System design and domain overview.
- `docs/deployment.md`: Standard deployment guidance.
- `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`: Step-by-step production operations runbook.
- `docs/PRODUCTION_RELEASE_CHECKLIST.md`: Pre-release gating criteria.
- `docs/AWS_EC2_DEPLOYMENT_PLAN.md`: EC2 deployment blueprint.
- `docs/SELF_HOSTED_DEPLOYMENT_GUIDE.md`: Zero-cost self-hosted setup.
- `docs/frontend/`: API contract, E2E testing docs, and integration plan.

---

## 3. Facts vs. Assumptions

### Verified Facts
1. The working copy `C:\CareerBridge-Safety-Copy` is cleanly separated on disk from the original repository `C:\Users\HP\OneDrive\Desktop\CareerBridge`.
2. Git branch is `integrate-careerbridge-redesign` at commit `beb86dc`.
3. The disposable database container `careerbridge-test-disposable` is currently running, mounted to volume `careerbridge_test_disposable_data`, with no published ports and isolated network mode.
4. Database `internship_test_db` inside `careerbridge-test-disposable` is at Alembic migration revision `b8c9d0e1f2a3`, matching the code head.
5. All 35 application tables exist and are owned by `test_user`.
6. Host has Python 3.11.9, pytest 9.1.1, Node.js v24.18.0, and npm 11.16.0 installed.

### Explicit Non-Assumptions
- We do **not** assume tests pass; no full test run has been executed yet.
- We do **not** assume frontend build succeeds without running `npm run build`.
- We do **not** assume any network connectivity to `careerbridge-test-disposable` until an isolation design is verified.
- We do **not** assume `test_user` can be used by test clients (it is a superuser and prohibited by Rule 0).
