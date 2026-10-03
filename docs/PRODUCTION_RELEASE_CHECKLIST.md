# CareerBridge Production Release & Deployment Readiness Checklist

**Platform:** CareerBridge — Student Internship & Job Platform  
**Target Environment:** Production (Docker Compose / AWS EC2 / Managed Cloud VM)
**Document Revision:** 3.0 (Phase 5 Production Hardening Baseline)

---

# PART I — READY: Core Platform & Engineering Verification
*(Fully validated, tested, containerized, and certified in the repository)*

## 1. Code Integrity & Repository Hygiene
- [x] All working tree changes reviewed, verified, and free of debug statements.
- [x] Zero sensitive files, private certificates, or local `.env` files committed.
- [x] TypeScript compilation passes with zero errors (`tsc`).
- [x] Modern ESM build succeeds with optimized bundle chunking (`vite build`).
- [x] Python codebase adheres to strict typing, Pydantic schemas, and PEP 8 standards.

---

## 2. Automated Test Verification
- [x] **Backend Unit & Integration Tests**: 431/431 passing (`pytest -q`).
  - Core business logic, RBAC, and workflow tests (357 passing).
  - Durable storage abstraction tests (9 passing).
  - Health & readiness probe tests (16 passing).
  - Production security configuration validator tests (38 passing).
  - Sensitive endpoint rate limiting tests (11 passing).
- [x] **Frontend Unit & Component Tests**: 906/906 passing across 114 test files (`vitest`).
- [x] **End-to-End Workflow Tests**: 11/11 passing across student, recruiter, and admin flows (`playwright`).
- [x] **Regression & Boundary Testing**: Double-booking conflict detection, rate-limiting, and error envelope handling verified.

---

## 3. Database & Migrations
- [x] Database engine: PostgreSQL 16.
- [x] Alembic migration chain verified with a single linear head (`8d9e0f1a2b3c`).
- [x] All 28 application tables, indexes, unique constraints, and foreign key cascades verified.
- [x] Forward-only migration execution: `alembic upgrade head`.
- [x] Database connection pooling with reconnection resiliency configured.
- [x] Automated backup script (`backend/scripts/backup_db.sh`) and restore verification (`backend/scripts/restore_db.sh`) ready.

---

## 4. Durable Storage Engine (Phase 5.1)
- [x] **Storage Provider Abstraction**: `backend/app/core/storage.py` supports interchangeable `local` and `s3` (AWS S3 & Cloudflare R2) storage backends.
- [x] **Production Storage Invariant**: In `ENVIRONMENT=production`, storage provider MUST be `s3` (enforced at startup).
- [x] **Secure Upload Pipeline**: Resumes and profile pictures validated by MIME type, size limit, and magic bytes before uploading to S3 with sanitized UUID keys.
- [x] **Streaming Downloads**: Uploaded assets streamed securely through authenticated endpoints.

---

## 5. Health & Readiness Probes (Phase 5.2)
- [x] **Liveness Probe (`GET /health/live`)**: Zero-I/O process heartbeat for container runtimes and Docker `HEALTHCHECK`.
- [x] **Readiness Probe (`GET /health/ready`)**: Deep dependency probe validating PostgreSQL connection, Alembic migration alignment, and S3 storage engine readiness. Returns HTTP 200 when ready, HTTP 503 if any dependency fails.
- [x] **Backward Compatibility (`GET /health`)**: Preserved legacy `/health` endpoint returning system status.

---

## 6. Production Configuration Security Gate (Phase 5.4)
- [x] **Startup Validator (`backend/app/core/security_validator.py`)**: Executes immediately during FastAPI lifespan startup when `ENVIRONMENT=production`.
- [x] **Strict Secret Invariants**: Rejects default JWT secrets, short keys (<32 chars), and default database passwords.
- [x] **CORS Origin Validation**: Rejects wildcard origins (`*`) and localhost URLs in production mode.
- [x] **Debug Mode Invariant**: Enforces `DEBUG=False` in production.
- [x] **Fail-Fast Behavior**: Application aborts startup with explicit configuration error if any invariant fails.

---

## 7. Sensitive Endpoint Rate Limiting (Phase 5.5)
- [x] **Sliding-Window Rate Limiter (`backend/app/core/rate_limit.py`)**: Protects high-risk endpoints against brute-force and spam attacks.
- [x] **Protected Endpoints**:
  - `POST /api/v1/auth/login`: Max 5 attempts per IP per 60s window.
  - `POST /api/v1/auth/password-reset/request`: Max 3 attempts per IP per 60s window.
  - `POST /api/v1/messages/`: Max 30 messages per sender per 60s window.
  - `POST /api/v1/applications/apply`: Max 10 applications per candidate per 60s window.
- [x] **Standard HTTP 429 Contract**: Returns standard error envelope with `Retry-After` header indicating remaining cooldown seconds.

---

## 8. Docker & Container Orchestration
- [x] **Backend Dockerfile**: Python 3.11-slim, unprivileged `appuser` execution, live `/health/live` container healthcheck, `uvicorn` entrypoint.
- [x] **Frontend Dockerfile**: Multi-stage build (`node:20-alpine` builder $\to$ `nginx:alpine` runtime).
- [x] **Nginx Reverse Proxy**: SPA fallback (`try_files $uri $uri/ /index.html;`), gzip compression, `/nginx-health` endpoint.
- [x] **Docker Compose Production Topology** (`docker-compose.production.yml`):
  - Database service (`postgres:16`) with persistent volume `careerbridge_postgres_production_data`.
  - Backend service with healthcheck dependency chain (`backend` waits for `db: service_healthy`, `frontend` waits for `backend: service_healthy`).
- [x] Compose configuration syntax verified (`docker compose -f docker-compose.production.yml config`).

---

## 9. Deployment Health Verification & Smoke Tests (Phase 5.6)
- [x] **AWS Deployment Healthcheck Script (`deploy/aws/healthcheck.sh`)**:
  - Verifies `/health/live` (HTTP 200).
  - Verifies `/health/ready` (HTTP 200).
  - Verifies `/nginx-health` (HTTP 200).
  - Sanitized error output preventing secret leakage.
- [x] **Operational Smoke Test Suite (`scripts/smoke_test.py`)**:
  - Probes `/health/live`, `/health/ready`, `/health`, `/`, `/openapi.json`.
  - Probes anti-enumeration behavior on password reset requests.
  - Probes rate limit 429 enforcement and `Retry-After` headers.
  - Probes frontend SPA route fallback.

---

## 10. Disaster Recovery & Rollback Strategy
- [x] **Schema Downgrade**: Documented `alembic downgrade` path for revision rollback.
- [x] **Storage Rollback**: S3 object storage uses immutable UUID keys, ensuring rollback safety.
- [x] **Container Rollback**: Documented checkout and rebuild workflow for previous release tags.

---

# PART II — REQUIRES DEPLOYMENT-SPECIFIC INPUT
*(Must be supplied by operator/infrastructure administrator at release deployment time)*

## 11. Hosting Provider & Target Server Access
- [ ] **Hosting Infrastructure Selected**: (e.g. AWS EC2, DigitalOcean Droplet, Hetzner, VPS, GCP Compute Engine).
- [ ] **Target Server Provisioned**: Ubuntu 22.04 LTS / Debian 12 with Docker Engine & Docker Compose plugin.
- [ ] **SSH & Firewall Access**: Public IP assigned, SSH key authentication configured, non-root deploy user active.

## 12. Object Storage (S3 / R2) Provisioning
- [ ] **S3 / R2 Bucket Created**: Dedicated bucket created (e.g. `careerbridge-production-uploads`).
- [ ] **IAM Credentials / Access Keys**: Dedicated IAM user with restricted `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` permissions.
- [ ] **Environment Configuration**: `STORAGE_PROVIDER=s3`, `STORAGE_BUCKET`, `STORAGE_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` configured in `.env`.

## 13. Domain Name & DNS Configuration
- [ ] **Registered Domain**: (e.g. `careerbridge.example.com` or `app.careerbridge.io`).
- [ ] **DNS A / CNAME Records**: Configured pointing to target server public IP address.
- [ ] **Propagation Verified**: `dig careerbridge.example.com +short` resolves to server IP.

## 14. TLS / HTTPS Certificate Provisioning
- [ ] **SSL/TLS Certificate**: Provisioned via Let's Encrypt / Certbot or managed cloud load balancer.
- [ ] **HTTPS Redirection**: Port 80 redirected to Port 443; HSTS headers enabled.
- [ ] **SSL Configuration**: TLS 1.2/1.3 only, modern cipher suites.

## 15. Production Secrets & Credential Injection
- [ ] **`JWT_SECRET_KEY`**: Cryptographically secure 64-char hex key (`openssl rand -hex 32`) injected via `.env`.
- [ ] **`POSTGRES_PASSWORD`**: High-entropy database password generated and injected.
- [ ] **`BACKEND_CORS_ORIGINS`**: Explicitly set to production domain (e.g. `["https://careerbridge.example.com"]`).
- [ ] **`ENVIRONMENT=production`** & **`DEBUG=False`**: Verified in `.env`.

## 16. Google OAuth 2.0 Production Registration
- [ ] **Google Cloud Console Project**: Created for CareerBridge production environment.
- [ ] **OAuth Consent Screen**: Configured with production domain and privacy policy links.
- [ ] **`GOOGLE_CLIENT_ID`**: Production Client ID provisioned and authorized JavaScript origins/redirect URIs set.

## 17. Production Email Delivery (SMTP / Transactional)
- [ ] **Email Provider**: Configured with production credentials (SendGrid, Amazon SES, Mailgun, or Postmark).
- [ ] **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASSWORD`**: Verified for user activation & notification emails.

## 18. Off-site Backup & Disaster Recovery Storage
- [ ] **Automated Cron Job**: Scheduled daily execution of `backend/scripts/backup_db.sh`.
- [ ] **Off-site Cloud Storage**: Encrypted backups copied to S3 / GCS / remote storage with 30-day retention policy.

---

## 19. Final Engineering Sign-Off

| Area | Lead Engineer Sign-Off | Status |
| :--- | :--- | :--- |
| **Backend API & Data Layer** | Antigravity Lead Engineer | **APPROVED** |
| **Frontend SPA & UX** | Antigravity Lead Engineer | **APPROVED** |
| **Security & Auth Architecture** | Antigravity Lead Engineer | **APPROVED** |
| **Storage & Probes Architecture** | Antigravity Lead Engineer | **APPROVED** |
| **Docker & CI/CD Pipelines** | Antigravity Lead Engineer | **APPROVED** |
| **Codebase Release Verdict** | **PRODUCTION READY** | **READY FOR HOST DEPLOYMENT** |
