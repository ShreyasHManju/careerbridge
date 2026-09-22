# CareerBridge Browser End-to-End Testing (Playwright)

## Overview
Phase F-12 introduces automated browser end-to-end (E2E) testing powered by [Playwright](https://playwright.dev/). This provides the top tier of the CareerBridge testing pyramid, validating realistic user journeys across isolated browser sessions for Student, Recruiter, and Admin roles.

---

## Testing Pyramid Architecture

1. **Unit & Component Testing (Vitest + Testing Library)**:
   - Tests individual UI components, forms, validation rules, hooks, and client state.
   - Located in `frontend/src/**/__tests__`.
   - Runs fast in jsdom (`npm test`).

2. **Backend Integration Testing (FastAPI TestClient + SQLAlchemy)**:
   - Tests REST endpoints, RBAC permissions, database models, email dispatch, and business logic.
   - Located in `backend/test_*.py`.
   - Runs against local PostgreSQL database (`python run_tests.py`).

3. **Browser E2E Testing (Playwright + Chromium)**:
   - Tests real browser DOM interactions, route transitions, localStorage authentication persistence, and multi-actor workflows.
   - Located in `frontend/e2e/*.spec.ts`.
   - Runs against real frontend dev server and FastAPI backend (`npm run test:e2e`).

---

## Prerequisites & Installation

1. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Install Playwright Browsers (Chromium)**:
   ```bash
   npx playwright install chromium
   ```

3. **Backend Service Requirements**:
   - Ensure the PostgreSQL database is running.
   - Ensure the FastAPI backend server is active at `http://127.0.0.1:8000`:
     ```bash
     cd backend
     .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
     ```

---

## Running E2E Tests

### Run all E2E specs in headless mode
```bash
cd frontend
npm run test:e2e
```

### Run specific spec file
```bash
npx playwright test e2e/auth.spec.ts
npx playwright test e2e/student-recruiter-flow.spec.ts
npx playwright test e2e/admin-moderation.spec.ts
```

### Run in UI / Interactive mode
```bash
npx playwright test --ui
```

---

## Test Data Strategy & Isolation

- **Independent Browser Contexts**: Multi-role flows (e.g., student applying to recruiter job) utilize isolated `browser.newContext()` instances so sessions and local storage do not leak.
- **Dynamic Deterministic Test Accounts**: Student and recruiter accounts are registered dynamically via the UI using timestamp-tagged emails (`e2e_student_<timestamp>@careerbridge.io`).
- **Global Setup & Seed**: `e2e/global-setup.ts` provisions a verified admin account (`admin_e2e@careerbridge.io`) before test execution.
- **Global Teardown & Database Hygiene**: `e2e/global-teardown.ts` runs `e2e/cleanup_e2e_db.py` after test completion to remove transient `e2e_%` users and job postings, ensuring backend unit test assertions remain unaffected.
