# CareerBridge — Production Deployment Guide

This document provides complete, production-grade instructions for deploying, hardening, and operating the **CareerBridge** backend.

---

## 1. Local Production-Like Docker Deployment

CareerBridge includes a fully isolated, production-like Docker Compose configuration located at `backend/docker-compose.production.yml`. It runs the FastAPI backend and PostgreSQL 16 on a private bridge network without exposing the database to the host machine.

### Architecture Overview

```
                          ┌──────────────────────────┐
                          │   Host / Reverse Proxy   │
                          │   (e.g., Port 80 / 443)  │
                          └─────────────┬────────────┘
                                        │ HTTP: 8000
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ careerbridge_production_net (Bridge Network)                              │
│                                                                           │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │ careerbridge_backend_production (FastAPI + Uvicorn)              │    │
│   │ - Unprivileged user: appuser (UID 10001)                         │    │
│   │ - Persistent Volume: /app/uploads                                │    │
│   └───────────────────────────────┬──────────────────────────────────┘    │
│                                   │ TCP: 5432 (Internal only)             │
│                                   ▼                                       │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │ careerbridge_db_production (PostgreSQL 16 Alpine)                │    │
│   │ - Persistent Volume: /var/lib/postgresql/data                    │    │
│   └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Launching the Stack

To build and start the containers in detached mode:

```bash
cd backend
docker compose -f docker-compose.production.yml up -d --build
```

### Checking Status and Logs

```bash
# View running containers
docker compose -f docker-compose.production.yml ps

# Follow container logs
docker compose -f docker-compose.production.yml logs -f backend

# Stop the stack (preserving volumes)
docker compose -f docker-compose.production.yml down
```

---

## 2. Required Environment Variables

Configuration is driven by environment variables loaded from the operating system environment or a `.env` file. A reference template is provided in `backend/.env.example`.

### Mandatory Production Variables

| Variable | Description | Example / Recommendation |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Target environment mode | `production` |
| `DEBUG` | FastAPI debug mode | `False` (Must never be `True` in production) |
| `JWT_SECRET_KEY` | Cryptographic secret for signing JWT tokens | 64-character random hex string (`openssl rand -hex 32`) |
| `POSTGRES_USER` | Database username | `careerbridge_admin` |
| `POSTGRES_PASSWORD` | Database password | Cryptographically strong password |
| `POSTGRES_DB` | Database name | `careerbridge_prod` |
| `BACKEND_CORS_ORIGINS` | Comma-separated list or JSON array of allowed origins | `"https://careerbridge.example.com"` |

### Optional Variables (Sensible Defaults Provided)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `CareerBridge` | Application title reported in OpenAPI |
| `API_V1_STR` | `/api/v1` | URL routing prefix for all V1 endpoints |
| `POSTGRES_HOST` | `localhost` (local) / `db` (compose) | Database host address |
| `POSTGRES_PORT` | `5432` | Database port |
| `DATABASE_URL` | *Derived from POSTGRES_** | Explicit URI (supports `postgresql://` and `postgres://`) |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded resumes and profile photos |
| `MAX_RESUME_SIZE_MB` | `5` | Maximum allowed size for resume PDF uploads |
| `MAX_PROFILE_IMAGE_SIZE_MB` | `2` | Maximum allowed size for profile images |
| `EMAIL_PROVIDER` | `local` | `local` (logs to console) or `smtp` (live delivery) |
| `EMAIL_FROM` | `no-reply@careerbridge.io` | Default sender email address |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for links in email notifications |
| `RATE_LIMIT_LOGIN_ENABLED` | `True` | Sliding-window brute force defense for login |
| `RATE_LIMIT_LOGIN_MAX_ATTEMPTS` | `5` | Max failed logins before 429 response |
| `RATE_LIMIT_LOGIN_WINDOW_SECONDS` | `60` | Time window for failed login count |

---

## 3. Secret Handling & Key Generation

Never hardcode credentials or commit `.env` files to source control.

### Generating Cryptographically Secure Secrets

Generate your `JWT_SECRET_KEY` and database passwords using standard cryptographic tools:

```bash
# Using OpenSSL (Recommended)
openssl rand -hex 32

# Using Python secrets module
python -c "import secrets; print(secrets.token_hex(32))"
```

### Secret Injection in Production
- **Docker Compose / Swarm**: Store secrets in Docker Secrets or an encrypted `.env` file with restrictive permissions (`chmod 600 .env`).
- **Kubernetes**: Inject secrets via `k8s Secret` resources mounted as environment variables.
- **Cloud PaaS (Render, AWS ECS, GCP Cloud Run)**: Configure variables directly in the provider's encrypted environment variable dashboard.

---

## 4. Database Migration Procedure

> [!IMPORTANT]
> **Migrations are intentionally NOT executed automatically on container startup.**
> Running automatic migrations at container boot introduces fatal race conditions when multiple container replicas start concurrently. Database migrations must always be executed as an explicit, controlled deployment step.

### Running Migrations in Docker

Run Alembic directly inside the running backend container:

```bash
# Execute migrations to the latest revision
docker compose -f docker-compose.production.yml exec backend alembic upgrade head

# Inspect current revision
docker compose -f docker-compose.production.yml exec backend alembic current

# Inspect migration history
docker compose -f docker-compose.production.yml exec backend alembic history
```

### Running Migrations Standalone / CI/CD

When running migrations from a deployment pipeline or host machine with access to the database:

```bash
cd backend
# Ensure DATABASE_URL is set in environment
alembic upgrade head
```

---

## 5. Health Check & Monitoring

CareerBridge exposes dedicated monitoring endpoints designed for load balancers, container orchestrators, and uptime probes:

### Endpoint: `GET /health`

The `/health` endpoint performs an end-to-end active probe against the database engine (`SELECT 1`).

- **Healthy Status (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "service": "CareerBridge Backend",
    "version": "1.0.0",
    "database": "connected"
  }
  ```
- **Degraded Status (HTTP 503 Service Unavailable)**:
  Returned when PostgreSQL is unreachable or actively failing:
  ```json
  {
    "status": "unhealthy",
    "service": "CareerBridge Backend",
    "version": "1.0.0",
    "database": "disconnected"
  }
  ```

### Container Healthcheck

The Dockerfile and Docker Compose configurations can verify container liveness using:

```bash
curl -f http://localhost:8000/health || exit 1
```

---

## 6. API Documentation

CareerBridge ships with interactive OpenAPI documentation available at standard endpoints:

- **Swagger UI**: `/docs` (Interactive API explorer and execution interface)
- **ReDoc**: `/redoc` (Structured API specification viewer)
- **OpenAPI Schema**: `/openapi.json` (Machine-readable OpenAPI 3.1 schema)

### Production Documentation Policy

In public production environments, you may choose to restrict public access to API docs. To disable interactive documentation in production while preserving API endpoints, configure `openapi_url=None`, `docs_url=None`, and `redoc_url=None` when `ENVIRONMENT == "production"` or restrict `/docs` and `/redoc` at your reverse proxy layer.

---

## 7. Upload Persistence

User-submitted resumes (`/app/uploads/resumes`) and profile images (`/app/uploads/profile_images`) are stored on the filesystem.

### Named Volume Storage

In `docker-compose.production.yml`, storage persistence is guaranteed through the dedicated named volume:

```yaml
volumes:
  careerbridge_uploads_production:
    driver: local
```

The volume is mounted to the container at `/app/uploads`:

```yaml
services:
  backend:
    volumes:
      - careerbridge_uploads_production:/app/uploads
```

### File Permissions & Security
- The container runs as unprivileged user `appuser` (UID `10001`, GID `10001`).
- The directory `/app/uploads` is created during image build and owned by `appuser`.
- Application-level validators enforce magic bytes validation and strict file extension blocklists (preventing executable uploads like `.exe`, `.sh`, `.php`, `.py`).
- Filenames are randomized with UUIDs on upload to prevent path traversal attacks.

---

## 8. WebSocket Requirements

CareerBridge features real-time bidirectional messaging between students and recruiters at:

```
ws://<host>/api/v1/ws/messages?token=<jwt_token>
```

### In-Memory Connection Architecture
- The WebSocket subsystem uses an in-memory `ConnectionManager` that tracks active connections by `user_id`.
- Connection authentication occurs during the initial WebSocket handshake via the query parameter `?token=...`.
- In-memory routing supports single-instance deployments out of the box. Multi-instance horizontal scaling across multiple container nodes requires a shared Pub/Sub message broker (e.g., Redis).

### Proxy Timeout Configuration
WebSockets are persistent connections. Ensure reverse proxies do not prematurely close idle connections:
- Set proxy read and send timeouts to at least 3600–86400 seconds (or configure WebSocket ping/pong keepalives).

---

## 9. Reverse Proxy Considerations (Nginx / Caddy / Cloudflare)

The production Uvicorn server is configured with:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=*
```

This allows Uvicorn to securely read client IPs from the `X-Forwarded-For` header and protocol from `X-Forwarded-Proto`.

> [!CAUTION]
> **Reverse proxy headers are critical for rate limiting.**
> CareerBridge tracks failed login attempts by client IP (`login:{ip}:{email}`). If reverse proxy headers are omitted, all client requests will appear to originate from the proxy's internal IP (e.g., `127.0.0.1` or `172.18.0.1`), causing rate-limiting collisions across different users.

### Sample Nginx Configuration

```nginx
upstream careerbridge_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.careerbridge.example.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/careerbridge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/careerbridge.example.com/privkey.pem;

    # Max upload size (matching backend resume upload limit)
    client_max_body_size 10M;

    # Standard API Proxy
    location / {
        proxy_pass http://careerbridge_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Messaging Support
    location /api/v1/ws/ {
        proxy_pass http://careerbridge_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 10. CORS Configuration

CareerBridge enforces strict Cross-Origin Resource Sharing (CORS) origin controls via FastAPI `CORSMiddleware`.

### Configuration Rules
- Set `BACKEND_CORS_ORIGINS` to the exact public origin of your frontend application:
  ```env
  BACKEND_CORS_ORIGINS="https://careerbridge.example.com"
  ```
- Multiple origins may be specified as a comma-separated string or JSON array:
  ```env
  BACKEND_CORS_ORIGINS="https://careerbridge.example.com,https://admin.careerbridge.example.com"
  ```
- **Never** configure `BACKEND_CORS_ORIGINS="*"` when credentials (cookies/authorization headers) are supported.

---

## 11. Production Security Checklist

Before exposing the application to public internet traffic, verify every item:

- [ ] **Debug Mode Disabled**: Ensure `DEBUG=False` in your production environment.
- [ ] **Environment Set**: Ensure `ENVIRONMENT=production`.
- [ ] **Cryptographic Secret**: Ensure `JWT_SECRET_KEY` is a unique, randomly generated 32+ byte hex string.
- [ ] **Default Passwords Changed**: Ensure `POSTGRES_PASSWORD` is strong and unique.
- [ ] **Non-Root Container Execution**: Verify `Dockerfile` executes as user `appuser` (UID 10001).
- [ ] **Security Headers Active**: Responses must include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] **Rate Limiting Active**: Verify `RATE_LIMIT_LOGIN_ENABLED=True` to protect against credential stuffing.
- [ ] **Database Network Isolation**: Ensure port 5432 is not bound to public host interfaces.
- [ ] **HTTPS / TLS Enforced**: Reverse proxy must terminate SSL and redirect HTTP to HTTPS.

---

## 12. Rollback Considerations

### Application Container Rollback
- Tag every production Docker image with its Git commit SHA (e.g., `careerbridge-backend:fa578b0`) rather than deploying solely as `:latest`.
- If a regression occurs, immediately redeploy the prior known-good image tag.

### Database Migration Rollback
- CareerBridge migrations are managed via Alembic.
- To rollback a single migration:
  ```bash
  docker compose -f docker-compose.production.yml exec backend alembic downgrade -1
  ```
- **Best Practice**: Design schema migrations to be additive and backwards-compatible (expand before contract) so rolling back application code does not immediately break the database.

---

## 13. Cloud-Provider Requirements

CareerBridge is cloud-agnostic and runs on any modern container-native infrastructure.

### Minimum System Specifications
- **Architecture**: Linux x86_64 or arm64 (multi-arch supported).
- **Compute**: 1 vCPU, 1 GB RAM (2 vCPU, 2 GB RAM recommended for production traffic).
- **Storage**: Minimum 10 GB persistent block storage for PostgreSQL and uploaded resumes.

### Supported Environments
- **Container Services**: Docker Engine 24+, Docker Compose v2, AWS ECS (Fargate or EC2), GCP Cloud Run, Azure Container Apps.
- **Database**: PostgreSQL 16+ (Docker container, AWS RDS PostgreSQL, Supabase, Neon, or GCP Cloud SQL).

---

## 14. Free-Tier & Cost Warnings

When deploying to free-tier cloud platforms (e.g., Render, Railway, Fly.io, Neon, Supabase), be aware of the following operational constraints:

1. **Ephemeral Filesystem Caveat**:
   Free compute instances typically discard local files on restart or sleep. Uploaded resumes and photos in `/app/uploads` will be **permanently lost** unless a persistent volume disk is explicitly attached.
2. **Database Connection Limits & Sleep**:
   Free managed databases often enforce strict connection pools (e.g., max 20 connections) and automatically suspend inactive databases, causing significant initial connection latency.
3. **Cold Starts**:
   Free compute tiers spin down containers after 15 minutes of inactivity. The initial incoming request will experience a 30–60 second cold start delay.
4. **Permanent Zero-Cost Fallacy**:
   No high-availability production application can operate indefinitely on purely free tiers. For durable production workloads, provision at least a dedicated persistent storage volume and a non-sleeping database tier.

---

## 15. Future AWS EC2 Deployment

> [!IMPORTANT]
> **STATUS: NOT YET DEPLOYED (LOCAL CONFIGURATION ONLY)**
> No AWS resources (EC2, RDS, S3, VPC, Security Groups, IAM, or Elastic IPs) have been created or provisioned. This section serves as the technical and operational blueprint for a future, cost-conscious deployment when cloud resources are explicitly authorized.

### 15.1 Architecture Overview

The recommended production architecture for AWS is a single EC2 instance (e.g., `t2.micro` or `t3.micro` under the AWS Free Tier) running Docker Compose behind an EC2 host-level Nginx reverse proxy:

```
                          ┌──────────────────────────┐
                          │     Internet Users       │
                          └─────────────┬────────────┘
                                        │ HTTPS: 443 / HTTP: 80
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Amazon EC2 Host (Ubuntu 22.04 / 24.04 LTS)                                │
│                                                                           │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │ Nginx Reverse Proxy (Host)                                       │    │
│   │ - SSL Termination (Let's Encrypt / Certbot)                      │    │
│   │ - WebSocket Upgrade Header Forwarding                            │    │
│   │ - X-Forwarded-For Client IP Sanitization                         │    │
│   └───────────────────────────┬──────────────────────────────────────┘    │
│                               │ HTTP: 127.0.0.1:8000                      │
│                               ▼                                           │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │ Docker: careerbridge-backend-production (FastAPI + Uvicorn)      │    │
│   │ - Unprivileged appuser (UID 10001)                               │    │
│   │ - Bound strictly to 127.0.0.1:8000:8000                          │    │
│   │ - Named Volume: careerbridge_uploads_production -> /app/uploads │    │
│   └───────────────────────────┬──────────────────────────────────────┘    │
│                               │ PostgreSQL: 5432 (Internal Docker net)   │
│                               ▼                                           │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │ Docker: careerbridge-db-production (PostgreSQL 16 Alpine)        │    │
│   │ - Named Volume: careerbridge_postgres_production_data            │    │
│   └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Required Host Packages
A minimal Ubuntu LTS installation requires:
- `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-compose-plugin` (Docker Engine and Compose V2)
- `nginx` (Host-level reverse proxy)
- `certbot`, `python3-certbot-nginx` (Automated Let's Encrypt SSL management)
- `ufw` or AWS Security Groups for packet filtering
- System utilities: `curl`, `wget`, `git`

### 15.3 Docker Setup & Container Isolation
- Docker services run isolated within `careerbridge_production_net` bridge network.
- The backend container runs under unprivileged user `appuser` (UID `10001`, GID `10001`).
- Root filesystem is read/write only where necessary; uploaded files are confined to `/app/uploads`.

### 15.4 Nginx Role & Reverse Proxying
Host-level Nginx (`deploy/nginx/careerbridge.conf.example`) handles:
1. Public SSL termination on port 443.
2. HTTP to HTTPS automatic redirection on port 80.
3. Proxying REST traffic to `http://127.0.0.1:8000`.
4. WebSocket protocol upgrading for `/api/v1/ws/` connections with 24-hour read/send timeouts.
5. Client identity forwarding via `X-Forwarded-For` and `X-Forwarded-Proto`.

### 15.5 HTTPS & Let's Encrypt Concept
- Domain name points via DNS A-Record to the EC2 public Elastic IP.
- Certbot provisions and auto-renews free TLS certificates:
  ```bash
  sudo certbot --nginx -d api.yourdomain.example.com
  ```
- Certbot installs a systemd timer that automatically checks and renews certificates prior to expiry.

### 15.6 Port Exposure & Network Security
- **Strict Host Port Binding**: `backend/docker-compose.production.yml` specifies `127.0.0.1:8000:8000`.
- Uvicorn is **never** exposed on `0.0.0.0:8000`. External traffic cannot bypass Nginx.
- PostgreSQL port `5432` is internal to the Docker network and not published to any host interface.
- **AWS Security Group Inbound Rules**:
  - `TCP 80` (HTTP): `0.0.0.0/0`
  - `TCP 443` (HTTPS): `0.0.0.0/0`
  - `TCP 22` (SSH): Restricted strictly to administrator's personal IP (`your.ip.address/32`).

### 15.7 Proxy Header Security Justification
- In `backend/Dockerfile`, Uvicorn runs with `--proxy-headers --forwarded-allow-ips=*`.
- **Security Assessment**: This wildcard setting is secure **because and only because** the backend container port is bound strictly to `127.0.0.1:8000` and external requests can only enter through Nginx. Nginx overwrites/appends client IPs using `$proxy_add_x_forwarded_for`, eliminating client-side header spoofing.

### 15.8 Environment Variables & Secrets
- Store production variables in `/opt/careerbridge/backend/.env` with strict file permissions:
  ```bash
  chmod 600 /opt/careerbridge/backend/.env
  ```
- Generate cryptographically secure keys:
  ```bash
  openssl rand -hex 32
  ```
- Set `ENVIRONMENT=production`, `DEBUG=False`, and explicit `BACKEND_CORS_ORIGINS`.

### 15.9 PostgreSQL Storage & Persistence
- Database storage is managed via the Docker named volume `careerbridge_postgres_production_data`.
- In an EC2 deployment, Docker volumes reside on the instance's EBS root volume (`/var/lib/docker/volumes/`).
- Data persists across container restarts, image updates, and host reboots.

### 15.10 Upload Storage & Future S3 Migration
- Resumes and profile images persist in `careerbridge_uploads_production` (`/app/uploads`).
- **Object Storage (S3)** is **NOT required** for the initial single-instance EC2 deployment. S3 introduces additional IAM configurations, bucket policies, and potential egress charges. Retaining local EBS storage satisfies all current roadmap requirements safely.

### 15.11 Controlled Alembic Migrations
- Migrations must never be automated on container startup.
- Run migrations explicitly during deployment:
  ```bash
  docker compose -f docker-compose.production.yml exec backend alembic upgrade head
  ```

### 15.12 Health Checks & Monitoring
- Host-level and load-balancer probes monitor `GET /health`.
- Returns HTTP 200 when backend and database are healthy (`SELECT 1` ping).
- Returns HTTP 503 if PostgreSQL connectivity fails.

### 15.13 WebSocket Requirements
- CareerBridge's `WebSocketConnectionManager` operates in-memory.
- This design requires a **single backend process** (`workers=1` on a single container).
- Multi-instance scaling would require an external Pub/Sub message broker (e.g., Redis).

### 15.14 Backup Considerations
- **EBS Snapshots**: Schedule daily automated snapshots using AWS Data Lifecycle Manager (DLM).
- **Logical Backups**: Run automated daily cron jobs executing `pg_dump`:
  ```bash
  docker compose -f docker-compose.production.yml exec -T db pg_dump -U postgres internship_db | gzip > /opt/backups/backup_$(date +%Y%m%d).sql.gz
  ```

### 15.15 Rollback Considerations
- Tag container images with Git commit SHAs (e.g., `careerbridge-backend:c9b21cc`).
- If an issue occurs, revert the image tag in `docker-compose.production.yml` and restart the container.
- Use `alembic downgrade -1` only if schema migrations introduced backward-incompatible changes.

---

## 16. Financial Safety & Cloud Cost Management

> [!CAUTION]
> **FINANCIAL SAFETY DIRECTIVES FOR CLOUD DEPLOYMENTS**
>
> 1. **Zero-Resource Milestone**: This milestone is purely a local configuration preparation. No cloud resources have been created, and no charges have been incurred.
> 2. **Terms and Eligibility Can Change**: AWS Free Tier offerings, quotas, and terms vary by region, account age, and policy changes. Always inspect the current [AWS Free Tier Official Terms](https://aws.amazon.com/free/) immediately before provisioning.
> 3. **Never Assume Cloud Resources are Permanently Free**: Most AWS Free Tier allowances (such as EC2 `t2.micro`/`t3.micro` 750 hours and RDS 750 hours) apply only during the first 12 months after account creation.
> 4. **Mandatory Pre-Provisioning Budget Alerts**:
>    Before launching any cloud resource, create a zero-spend billing alert in the AWS Billing & Cost Management console:
>    - Create an **AWS Budget** with an alert threshold set at **$1.00 USD**.
>    - Configure email notifications to alert immediately on any forecasted or actual spend.
> 5. **Avoid High-Cost Traps**:
>    - Avoid provisioning Amazon RDS (Multi-AZ can cost upwards of $30–$40/month).
>    - Avoid Application Load Balancers (ALBs cost ~$16–$22/month baseline).
>    - Keep EBS storage allocations strictly at or below 30 GB.
>    - Terminate or stop unused instances promptly.
