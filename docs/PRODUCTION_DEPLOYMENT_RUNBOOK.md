# CareerBridge v1.0.0 — Production Deployment Runbook

**Document Revision:** 2.0 (Phase 5 Production Hardening Baseline)
**Target Platform:** Ubuntu 22.04 LTS / Ubuntu 24.04 LTS Cloud VM / AWS EC2
**Topology:** Single-Node Production Docker Compose (PostgreSQL 16 + FastAPI + Nginx SPA) + S3/R2 Object Storage
**Release Baseline:** `v1.0.0`

---

## 1. Prerequisites

Before initiating the deployment process, ensure you have:

- **Target Cloud Server**: Provisioned cloud instance (e.g. AWS EC2 `t3.medium`, DigitalOcean Droplet 4GB, Hetzner Cloud `CPX21`, or Google Cloud Compute Engine `e2-standard-2`).
- **Operating System**: Clean installation of Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (x86_64 or arm64).
- **SSH Credentials**: Dedicated non-root user with `sudo` privileges and public-key authentication configured.
- **Registered Domain Name**: Fully qualified domain name (e.g., `careerbridge.io` or `app.careerbridge.io`).
- **Object Storage Bucket**: AWS S3 or Cloudflare R2 bucket provisioned for durable uploads (resumes, profile pictures).
- **Third-Party API Accounts**:
  - Google Cloud Console project with OAuth 2.0 Web Client ID provisioned for the production domain.
  - Production SMTP service credentials (SendGrid, Amazon SES, Mailgun, or Postmark).

---

## 2. Target Deployment Architecture

```
                       [ Internet Users / Browsers ]
                                     │
                                     ▼ Port 443 (HTTPS) / 80 (HTTP Redirect)
                      ┌──────────────────────────────┐
                      │    Host Nginx / Cloudflare   │
                      │    TLS Termination (SSL)     │
                      └──────────────┬───────────────┘
                                     │
                                     ▼ Port 80 (Localhost / Internal)
       ┌─────────────────────────────────────────────────────────────┐
       │             Docker Compose Production Topology              │
       │                                                             │
       │  ┌───────────────────────────────────────────────────────┐  │
       │  │ frontend container (nginx:alpine)                     │  │
       │  │ - Serves React SPA static assets                      │  │
       │  │ - Handles SPA client-side routing fallback            │  │
       │  │ - Injects security headers & gzip compression         │  │
       │  │ - Proxies `/api/*`, `/health`, `/health/*`            │  │
       │  └──────────────────────────┬────────────────────────────┘  │
       │                             │                               │
       │                             ▼ Internal Docker Network       │
       │  ┌───────────────────────────────────────────────────────┐  │
       │  │ backend container (python:3.11-slim)                  │  │
       │  │ - Unprivileged appuser execution                      │  │
       │  │ - FastAPI / Uvicorn ASGI Server (Port 8000)           │  │
       │  │ - Production config security gate validation          │  │
       │  │ - In-memory / Durable rate limiting defense           │  │
       │  │ - Health Probes: `/health/live`, `/health/ready`      │  │
       │  └─────────────┬───────────────────────────┬─────────────┘  │
       │                │                           │                │
       │                ▼ Internal Network          ▼ HTTPS (TLS)    │
       │  ┌──────────────────────────┐   ┌────────────────────────┐  │
       │  │ db container             │   │ AWS S3 / Cloudflare R2 │  │
       │  │ (postgres:16)            │   │ Durable Object Storage │  │
       │  │ - Persistent volume data │   │ (Resumes & Avatars)    │  │
       │  └──────────────────────────┘   └────────────────────────┘  │
       └─────────────────────────────────────────────────────────────┘
```

---

## 3. Server Sizing & Hardware Requirements

| Resource | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **CPU** | 2 vCPUs | 4 vCPUs |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 40 GB NVMe SSD | 80 GB NVMe SSD |
| **Swap** | 2 GB Swapfile | 4 GB Swapfile |
| **Network** | 1 Gbps Shared / Static Public IPv4 | 1 Gbps Dedicated Static Public IPv4 |

### Configuring Swap (Recommended for 4GB instances)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Docker Engine & Compose Installation

Install the official Docker Engine and Docker Compose plugin from Docker's official apt repository:

```bash
# 1. Update package index and install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 2. Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Set up the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine, CLI, and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Enable Docker service on boot
sudo systemctl enable --now docker

# 6. Add deploy user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER
newgrp docker
```

---

## 5. Host Firewall Configuration (UFW)

Ensure strict boundary enforcement. Only SSH (22), HTTP (80), and HTTPS (443) are allowed inbound. PostgreSQL (5432) and FastAPI (8000) **must remain strictly inaccessible** from public networks.

```bash
# 1. Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Allow SSH (Port 22 or custom SSH port)
sudo ufw allow 22/tcp comment 'SSH Access'

# 3. Allow HTTP & HTTPS
sudo ufw allow 80/tcp comment 'HTTP Web Traffic'
sudo ufw allow 443/tcp comment 'HTTPS Encrypted Web Traffic'

# 4. Enable firewall
sudo ufw --force enable

# 5. Verify active status
sudo ufw status verbose
```

---

## 6. Repository Checkout & Version Selection

Clone the repository and check out the immutable release tag `v1.0.0`:

```bash
# 1. Clone repository into production directory
cd /opt
sudo git clone https://github.com/ShreyasHManju/careerbridge.git
sudo chown -R $USER:$USER /opt/careerbridge
cd /opt/careerbridge

# 2. Checkout production release tag
git checkout v1.0.0

# 3. Verify clean release status
git status
```

---

## 7. Production Environment Configuration

Create the production `.env` file from the repository template:

```bash
cp .env.example .env
chmod 600 .env
```

### Production Security Gate Invariants

When `ENVIRONMENT=production`, the application runs strict startup security validation (`backend/app/core/security_validator.py`). Startup will **fail immediately** if any of the following invariants are violated:
1. `JWT_SECRET_KEY` must be $\ge$ 32 characters, non-default, and high entropy.
2. `DEBUG` must be `False`.
3. `POSTGRES_PASSWORD` must be non-default and non-empty.
4. `BACKEND_CORS_ORIGINS` must not contain wildcards (`*`) or localhost domains.
5. `STORAGE_PROVIDER` must be set to `s3` with valid `STORAGE_BUCKET` and `STORAGE_REGION` configured (local storage is prohibited in production).
6. Rate limiting must be enabled (`RATE_LIMIT_ENABLED=True`).

### Environment Variable Contract Table

| Variable | Requirement | Description | Example / Method to Generate |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | **Required** | Deployment stage identifier | `production` |
| `DEBUG` | **Required** | Disables debug mode and interactive docs | `False` |
| `JWT_SECRET_KEY` | **Required** | High-entropy signing secret for JWT tokens | Generate with: `openssl rand -hex 32` |
| `POSTGRES_DB` | **Required** | Database name | `internship_db` |
| `POSTGRES_USER` | **Required** | Database superuser account name | `postgres` |
| `POSTGRES_PASSWORD` | **Required** | High-entropy database password | Generate with: `openssl rand -hex 24` |
| `STORAGE_PROVIDER` | **Required (Prod)** | Durable storage engine (`s3` in production, `local` in dev) | `s3` |
| `STORAGE_BUCKET` | **Required (Prod)** | S3 / R2 Bucket name | `careerbridge-production-uploads` |
| `STORAGE_REGION` | **Required (Prod)** | AWS S3 region (or `auto` for Cloudflare R2) | `us-east-1` |
| `STORAGE_ENDPOINT_URL` | Optional | Custom S3 endpoint (for Cloudflare R2 / MinIO) | `https://<account-id>.r2.cloudflarestorage.com` |
| `AWS_ACCESS_KEY_ID` | Conditional | S3 / R2 Access Key ID | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | Conditional | S3 / R2 Secret Access Key | S3 secret access key |
| `GOOGLE_CLIENT_ID` | **Required** | Google OAuth 2.0 Web Client ID | `xxxxxx.apps.googleusercontent.com` |
| `BACKEND_CORS_ORIGINS` | **Required** | Allowed origins for cross-origin requests | `["https://careerbridge.yourdomain.com"]` |
| `RATE_LIMIT_ENABLED` | Optional | Enable API rate limiting (defaults to `True`) | `True` |
| `RATE_LIMIT_LOGIN_MAX` | Optional | Max login attempts per IP per window | `5` (Default) |
| `RATE_LIMIT_PASSWORD_RESET_MAX` | Optional | Max password reset requests per IP / target | `3` (Default) |
| `RATE_LIMIT_MESSAGE_MAX` | Optional | Max direct messages sent per sender | `30` (Default) |
| `RATE_LIMIT_APPLICATION_MAX` | Optional | Max applications submitted per candidate | `10` (Default) |
| `RATE_LIMIT_WINDOW_SECONDS` | Optional | Sliding rate limit window duration in seconds | `60` (Default) |
| `FRONTEND_PORT` | Optional | Host port binding for frontend container | `80` (or `8080` if host reverse-proxying) |
| `EMAIL_PROVIDER` | Optional | Email backend provider (`mock`, `console`, `smtp`) | `smtp` |
| `SMTP_HOST` | Conditional | SMTP relay server hostname | `smtp.sendgrid.net` |
| `SMTP_PORT` | Conditional | SMTP relay server port | `587` |
| `SMTP_USER` | Conditional | SMTP authentication username | `apikey` |
| `SMTP_PASSWORD` | Conditional | SMTP authentication password / API key | Production API Key |
| `SMTP_FROM_EMAIL` | Conditional | Sender email address for notifications | `noreply@careerbridge.yourdomain.com` |

---

## 8. Database Migrations Execution

Before starting the full multi-service topology, run Alembic migrations against the healthy database container to initialize the schema:

```bash
# 1. Validate Docker Compose production configuration syntax
docker compose -f docker-compose.production.yml config

# 2. Start only the database container and wait for healthy status
docker compose -f docker-compose.production.yml up -d db

# 3. Wait for PostgreSQL healthcheck probe (returns 'healthy')
docker compose -f docker-compose.production.yml ps db

# 4. Execute linear database migrations up to head (rev: 8d9e0f1a2b3c)
docker compose -f docker-compose.production.yml run --rm backend alembic upgrade head
```

---

## 9. Application Startup & Container Orchestration

Launch the full production topology in detached mode:

```bash
# 1. Build and start all containers
docker compose -f docker-compose.production.yml up -d --build

# 2. Inspect running container status
docker compose -f docker-compose.production.yml ps

# Expected output:
# NAME                                 STATUS                  PORTS
# careerbridge-db-production           Up (healthy)            5432/tcp
# careerbridge-backend-production      Up (healthy)            127.0.0.1:8000->8000/tcp
# careerbridge-frontend-production     Up (healthy)            0.0.0.0:80->80/tcp
```

### Health Probe Endpoints
The container and orchestration layers expose specific probes:
- **Liveness (`GET /health/live`)**: Zero-I/O process heartbeat used by container runtimes (Docker `HEALTHCHECK`, Kubernetes liveness probe). Returns `{"status": "alive"}` immediately.
- **Readiness (`GET /health/ready`)**: Deep dependency probe validating PostgreSQL connectivity, Alembic schema head alignment, and S3 storage engine readiness. Used by load balancers, deployment gates, and AWS deployment scripts.
- **Legacy Compatibility (`GET /health`)**: Preserved backward-compatible health probe returning system status.

---

## 10. DNS Configuration

Configure DNS records at your domain registrar (e.g. Cloudflare, Route53, Namecheap):

| Record Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (or `careerbridge.yourdomain.com`) | `YOUR_SERVER_PUBLIC_IP` | 300s (Auto) |
| **A** / **CNAME** | `www` | `YOUR_SERVER_PUBLIC_IP` (or `@`) | 300s (Auto) |

### Verify DNS Propagation
```bash
dig +short careerbridge.yourdomain.com
# Should return your server's public IPv4 address
```

---

## 11. HTTPS & TLS Certificate Provisioning (Let's Encrypt / Certbot)

### Option A: Using Host-Level Nginx Reverse Proxy with Certbot (Recommended)
Bind frontend container to `127.0.0.1:8080` by setting `FRONTEND_PORT=8080` in `.env`, then install host Nginx:

```bash
# 1. Install Certbot and Host Nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 2. Create Host Nginx Configuration
sudo tee /etc/nginx/sites-available/careerbridge << 'EOF'
server {
    listen 80;
    server_name careerbridge.yourdomain.com www.careerbridge.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 3. Enable site and obtain TLS certificate
sudo ln -s /etc/nginx/sites-available/careerbridge /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d careerbridge.yourdomain.com -d www.careerbridge.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
```

### Option B: Cloudflare Proxied SSL (Flexible / Full SSL)
If using Cloudflare proxy (orange cloud), set Cloudflare SSL mode to **Full (Strict)** with Cloudflare Origin Certificates mapped to port 443.

---

## 12. Production Health Verification & Smoke Testing

### Automated AWS Deployment Verification
Run the deployment health verification script:
```bash
./deploy/aws/healthcheck.sh
```
This script validates:
- Backend liveness probe (`GET /health/live`)
- Backend readiness probe (`GET /health/ready` verifying DB, migrations, and storage)
- Frontend Nginx health probe (`GET /nginx-health`)
- Sanitized error output preventing secret leakage

### Automated Comprehensive Smoke Test Suite
Run the operational smoke test script across backend and frontend:
```bash
python scripts/smoke_test.py --backend-url http://127.0.0.1:8000 --frontend-url http://127.0.0.1:80
```

The smoke test validates:
1. `GET /health/live` returns HTTP 200 `status: alive`.
2. `GET /health/ready` returns HTTP 200 `status: ready` with valid DB and migration checks.
3. `GET /health` returns HTTP 200 (backward compatibility).
4. `GET /` returns HTTP 200 root response.
5. `GET /openapi.json` returns valid OpenAPI documentation schema.
6. `POST /api/v1/auth/password-reset/request` returns generic 200 without exposing email existence.
7. Rate limiting & `Retry-After` HTTP 429 contract verification on abuse-sensitive endpoints.
8. Frontend SPA fallback returns HTTP 200 and loads root HTML for dynamic client routes.

---

## 13. Logging & Monitoring

```bash
# View unified multi-container logs in real-time
docker compose -f docker-compose.production.yml logs -f --tail=100

# View backend logs specifically
docker compose -f docker-compose.production.yml logs -f backend

# View frontend access & error logs
docker compose -f docker-compose.production.yml logs -f frontend

# Configure Docker daemon log rotation (/etc/docker/daemon.json)
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
EOF
sudo systemctl restart docker
```

---

## 14. Database Backup Automation & Disaster Recovery

### Automated Daily PostgreSQL Backups via Cron
```bash
# Open crontab for deploy user
crontab -e

# Add scheduled daily backup at 02:00 UTC with 30-day retention cleanup
0 2 * * * cd /opt/careerbridge && ./backend/scripts/backup_db.sh >> /var/log/careerbridge_backup.log 2>&1
0 3 * * * find /opt/careerbridge/backups -name "*.sql" -mtime +30 -delete
```

### Database Restore Procedure
```bash
# Restore from a verified snapshot file
./backend/scripts/restore_db.sh /opt/careerbridge/backups/careerbridge_backup_internship_db_YYYYMMDD_HHMMSS.sql
```

---

## 15. Rollback Procedure

If an operational anomaly or critical regression occurs post-release:

1. **Check Out Prior Release Tag**:
   ```bash
   cd /opt/careerbridge
   git checkout <PREVIOUS_RELEASE_TAG>   # e.g., git checkout v0.9.0
   ```
2. **Roll Back Database Schema (if migration was applied)**:
   ```bash
   docker compose -f docker-compose.production.yml run --rm backend alembic downgrade <TARGET_REVISION>
   ```
   *Note: Ensure no active traffic is writing to deprecated columns before schema downgrade.*
3. **Storage Provider Considerations**:
   * S3 object keys are immutable UUIDs; rolling back code versions will not corrupt existing uploaded assets.
4. **Rebuild and Restart Containers**:
   ```bash
   docker compose -f docker-compose.production.yml up -d --build
   ```
5. **Run Verification & Smoke Tests**:
   ```bash
   ./deploy/aws/healthcheck.sh
   python scripts/smoke_test.py
   ```

---

## 16. Security Hardening Checklist

- [x] **SSH Hardening**: Password authentication disabled in `/etc/ssh/sshd_config` (`PasswordAuthentication no`), root login disabled (`PermitRootLogin no`).
- [x] **Firewall Isolation**: Only ports 22, 80, 443 permitted. PostgreSQL port 5432 closed to external interfaces.
- [x] **Non-Root Containers**: Backend runs under unprivileged `appuser` (UID 1000), frontend under `nginx`.
- [x] **Brute-Force Protection**: `fail2ban` installed and active for SSH service (`sudo apt-get install fail2ban`).
- [x] **Production Config Gate**: `security_validator.py` enforces production secrets, CORS origins, and S3 storage at startup.
- [x] **Abuse & Rate Limiting**: In-memory rate limiting with `Retry-After` headers protects login, password resets, messages, and applications.
- [x] **Unattended Security Updates**: Enabled via `sudo apt-get install unattended-upgrades`.
- [x] **Secret Isolation**: `.env` file set to `chmod 600` and excluded from source control.

---

## 17. Troubleshooting & FAQ

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **502 Bad Gateway on `/api/*`** | Backend container starting or crashed | Check backend logs: `docker compose logs backend`. Verify DB is healthy and `/health/live` is responding. |
| **Backend Startup Fails (Security Validator)** | Insecure production configuration detected | Check backend logs for `CRITICAL: Configuration validation failed`. Ensure `STORAGE_PROVIDER=s3`, `DEBUG=False`, strong `JWT_SECRET_KEY`, and valid `BACKEND_CORS_ORIGINS`. |
| **Database Connection Refused** | PostgreSQL container still initializing | Verify healthcheck: `docker compose ps db`. Check credentials in `.env`. |
| **Alembic Target database is not up to date** | Migrations pending | Run `docker compose run --rm backend alembic upgrade head`. |
| **S3 Upload Error** | Invalid credentials, bucket, or region | Verify `STORAGE_BUCKET`, `STORAGE_REGION`, and AWS credentials in `.env`. Check `/health/ready` probe output. |
| **Rate Limit 429 Too Many Requests** | Threshold exceeded for sensitive endpoint | Wait for window expiry specified in `Retry-After` header or adjust `RATE_LIMIT_*` settings in `.env`. |
| **CORS error in browser console** | `BACKEND_CORS_ORIGINS` mismatch | Ensure `.env` includes exact client scheme and domain `["https://yourdomain.com"]`. |
| **Port 80 already in use** | Apache or default Nginx running on host | Stop conflicting service: `sudo systemctl stop apache2 && sudo systemctl disable apache2`. |
