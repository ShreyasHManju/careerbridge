# CareerBridge — Production Deployment & Operations Guide

This document provides end-to-end, production-grade instructions for deploying, hardening, and operating the **CareerBridge** application on **Amazon Web Services (AWS) EC2** using **Ubuntu LTS**, **Docker Engine**, **Docker Compose**, **Nginx**, and **Let's Encrypt (Certbot)**.

---

## Architecture Overview

```
                                  ┌───────────────────────────────┐
                                  │        Internet Users         │
                                  └───────────────┬───────────────┘
                                                  │ HTTPS: 443 / WSS
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Amazon EC2 Host (Ubuntu 22.04 / 24.04 LTS)                                      │
│                                                                                 │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │ Host Nginx Reverse Proxy & SSL Termination                             │    │
│   │ • SSL/TLS Termination (Let's Encrypt Webroot / Certbot)                │    │
│   │ • Static SPA Frontend Hosting (/var/www/careerbridge/frontend)         │    │
│   │ • REST API Forwarding (/api/ -> 127.0.0.1:8000)                        │    │
│   │ • Diagnostics & Docs (/health, /docs, /redoc, /openapi.json)           │    │
│   │ • WebSocket Protocol Upgrades & 86400s Timeout (/api/v1/ws/)           │    │
│   │ • Client IP Sanitization (X-Forwarded-For, X-Real-IP)                  │    │
│   └───────────────────────────────────┬────────────────────────────────────┘    │
│                                       │ HTTP: 127.0.0.1:8000                    │
│                                       ▼                                         │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │ Docker: careerbridge-backend-production (FastAPI + Uvicorn)            │    │
│   │ • Unprivileged user: appuser (UID 10001)                               │    │
│   │ • Bound strictly to loopback: 127.0.0.1:8000:8000                      │    │
│   │ • Persistent Uploads Volume: careerbridge_uploads_production           │    │
│   │   mounted at /app/uploads (resumes & profile photos)                   │    │
│   └───────────────────────────────────┬────────────────────────────────────┘    │
│                                       │ PostgreSQL TCP: 5432 (Internal Docker)  │
│                                       ▼                                         │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │ Docker: careerbridge-db-production (PostgreSQL 16 Alpine)              │    │
│   │ • Internal Docker bridge network (No host port exposure)               │    │
│   │ • Persistent Database Volume: careerbridge_postgres_production_data   │    │
│   │   mounted at /var/lib/postgresql/data                                  │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. AWS Account Prerequisites

Before provisioning any infrastructure:
1. **Active AWS Account**: Ensure you have an active AWS account with administrative IAM permissions.
2. **AWS Free Tier & Sizing**: Check the current AWS Free Tier eligibility, instance pricing, and regional availability before provisioning.
3. **Mandatory Billing Alert**: Create a zero-spend billing alert in AWS Billing & Cost Management:
   - Navigate to **AWS Budgets** → **Create budget** → **Zero spend budget** (or alert threshold at **$1.00 USD**).
   - Configure email alerts so unexpected charges are caught immediately.

---

## 2. EC2 Instance Preparation

1. **Navigate to EC2 Console**: Open **EC2** → **Instances** → **Launch instances**.
2. **Name**: `careerbridge-production`
3. **Application and OS Images (AMI)**: **Ubuntu Server 24.04 LTS** (or **Ubuntu 22.04 LTS**) — 64-bit (x86_64 or arm64).
4. **Instance Type**: `t2.micro` or `t3.micro` (or an appropriate general-purpose instance size matching your workload).
5. **Key Pair**: Select an existing key pair or generate a new RSA `.pem` key pair (e.g., `careerbridge-key.pem`) and store it securely with `chmod 400 careerbridge-key.pem`.
6. **Storage**: Standard 20 GB to 30 GB gp3 root volume.
7. **Allocate Elastic IP (Static Public IP)**:
   - Go to **EC2** → **Network & Security** → **Elastic IPs** → **Allocate Elastic IP address**.
   - Associate this Elastic IP with your `careerbridge-production` instance.

---

## 3. Security Group Configuration

Create an AWS Security Group named `careerbridge-ec2-sg` with minimal required access:

| Type | Protocol | Port Range | Source | Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **SSH** | TCP | `22` | `YOUR_ADMIN_IP/32` | Administrative shell access restricted to your personal IP / CIDR |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Let's Encrypt ACME verification and HTTP-to-HTTPS redirect |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Encrypted web application, REST API, and WebSocket traffic |

> [!CAUTION]
> **NEVER expose Port 5432 (PostgreSQL) or Port 8000 (Backend) to `0.0.0.0/0` in your AWS Security Group.**
> All database and internal API communication must remain strictly contained within the EC2 host and Docker bridge network.

---

## 4. DNS Configuration

Point your custom domain name to the EC2 Elastic IP:

1. In your DNS registrar or AWS Route 53, create an **A-Record**:
   - **Host/Name**: `@` (or `careerbridge.YOUR_DOMAIN`)
   - **Type**: `A`
   - **Value / Destination**: `<YOUR_EC2_ELASTIC_IP>`
   - **TTL**: `300` (5 minutes)
2. Verify DNS propagation:
   ```bash
   # Run locally:
   nslookup YOUR_DOMAIN
   # or
   dig +short YOUR_DOMAIN
   ```

---

## 5. Server Bootstrap

Connect to your EC2 instance via SSH:

```bash
# Run locally:
ssh -i /path/to/careerbridge-key.pem ubuntu@<YOUR_EC2_ELASTIC_IP>
```

Execute host bootstrapping to configure tools, Docker, Node.js, UFW firewall, and swap:

```bash
# Run on EC2:
# 1. Update system
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release

# 2. Configure UFW Firewall with Restricted SSH Access
# IMPORTANT: Replace 'YOUR_ADMIN_IP/32' with your actual administrator IP/CIDR before enabling!
ADMIN_SSH_CIDR="YOUR_ADMIN_IP/32"

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from "$ADMIN_SSH_CIDR" to any port 22 proto tcp comment 'Admin SSH Access Only'
sudo ufw allow 80/tcp comment 'HTTP (Let'\''s Encrypt / Certbot & Redirect)'
sudo ufw allow 443/tcp comment 'HTTPS (Web & API Traffic)'
sudo ufw --force enable
sudo ufw status verbose

# 3. Configure 2GB Swap (prevents OOM on 1GB RAM instances during builds)
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=10
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
fi

# 4. Install Docker & Docker Compose V2
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu

# 5. Install Node.js 20 LTS (for building frontend bundle)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 6. Install Nginx & Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

> [!NOTE]
> If you modified Docker group membership above, log out and reconnect via SSH (or run `newgrp docker`) before running unprivileged Docker commands.

---

## 6. Application Checkout

Clone the repository into the standard production directory `/opt/careerbridge`:

```bash
# Run on EC2:
sudo mkdir -p /opt/careerbridge
sudo chown -R ubuntu:ubuntu /opt/careerbridge

git clone https://github.com/ShreyasHManju/careerbridge.git /opt/careerbridge
cd /opt/careerbridge
```

---

## 7. Production Environment Configuration

Create and secure the backend environment file:

```bash
# Run on EC2:
cd /opt/careerbridge/backend
cp .env.example .env
chmod 600 .env
```

Generate secure production secrets:

```bash
# Run on EC2 to generate JWT Secret:
openssl rand -hex 32

# Run on EC2 to generate Database Password:
openssl rand -hex 24
```

Edit `/opt/careerbridge/backend/.env` with your actual production values:

```env
# ==============================================================================
# CareerBridge Production Environment Configuration
# ==============================================================================
PROJECT_NAME=CareerBridge
ENVIRONMENT=production
DEBUG=False
API_V1_STR=/api/v1

# Security & Authentication (Replace with generated 64-char key)
JWT_SECRET_KEY=YOUR_GENERATED_JWT_SECRET_KEY
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database Configuration (PostgreSQL 16)
POSTGRES_USER=careerbridge_admin
POSTGRES_PASSWORD=YOUR_GENERATED_DB_PASSWORD
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=careerbridge_prod

# CORS & Networking (Point to your live HTTPS domain)
BACKEND_CORS_ORIGINS="https://YOUR_DOMAIN"
FRONTEND_URL="https://YOUR_DOMAIN"

# Uploads & Storage
UPLOAD_DIR=uploads
MAX_RESUME_SIZE_MB=5
MAX_PROFILE_IMAGE_SIZE_MB=2

# Email Notifications (local logging or external SMTP provider)
EMAIL_PROVIDER=local
EMAIL_FROM=no-reply@YOUR_DOMAIN
EMAIL_FROM_NAME=CareerBridge

# Rate Limiting
RATE_LIMIT_LOGIN_ENABLED=True
RATE_LIMIT_LOGIN_MAX_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW_SECONDS=60
```

---

## 8. Frontend Production Build

Build the static React single-page application and copy the distribution files to the web server root:

```bash
# Run on EC2:
cd /opt/careerbridge/frontend

# Install dependencies and compile production assets
npm ci
npm run build

# Create web root and deploy static assets
sudo mkdir -p /var/www/careerbridge/frontend
sudo cp -r dist/* /var/www/careerbridge/frontend/
sudo chown -R www-data:www-data /var/www/careerbridge
sudo chmod -R 755 /var/www/careerbridge
```

---

## 9. Docker Image & Build Process

Build the backend container image using the multi-stage production Dockerfile:

```bash
# Run on EC2:
cd /opt/careerbridge/backend
docker compose -f docker-compose.production.yml build
```

---

## 10. Starting the Stack & Health Gates

Start the isolated PostgreSQL 16 and FastAPI backend containers with automated health verification:

```bash
# Run on EC2:
cd /opt/careerbridge/backend
docker compose -f docker-compose.production.yml up -d --build

# 1. Verify PostgreSQL container health (strict bounded health gate)
echo "Waiting for PostgreSQL database container to become healthy..."
DB_HEALTHY=false
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' careerbridge-db-production 2>/dev/null | tr -d '"' || true)
    if [ "$STATUS" = "healthy" ]; then
        echo "PostgreSQL container is healthy."
        DB_HEALTHY=true
        break
    fi
    echo "Waiting for PostgreSQL health... attempt $i/30 (status: ${STATUS:-starting})"
    sleep 2
done

if [ "$DB_HEALTHY" != "true" ]; then
    echo "ERROR: PostgreSQL did not become healthy within the expected timeout."
    echo "Recent PostgreSQL logs:"
    docker compose -f docker-compose.production.yml logs --tail=100 db
    exit 1
fi

# 2. Run Alembic database migrations (only executed after database health gate passes)
docker compose -f docker-compose.production.yml exec backend alembic upgrade head
docker compose -f docker-compose.production.yml exec backend alembic current

# 3. Bounded backend health probe retry loop (HTTP 200 verification)
echo "Waiting for backend health probe (http://127.0.0.1:8000/health)..."
for i in {1..30}; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health || echo "FAILED")
    if [ "$CODE" = "200" ]; then
        echo "SUCCESS: CareerBridge backend returned HTTP 200."
        break
    fi
    echo "Backend status: ${CODE}... ($i/30)"
    sleep 2
done
```

---

## 11. Alembic Database Migrations

Apply database migrations explicitly once PostgreSQL reports healthy:

```bash
# Run on EC2:
cd /opt/careerbridge/backend

# Apply all migrations to head
docker compose -f docker-compose.production.yml exec backend alembic upgrade head

# Verify current database migration revision
docker compose -f docker-compose.production.yml exec backend alembic current
```

---

## 12. Nginx Configuration & First-Time Certificate Issuance

To prevent Nginx startup errors on a fresh EC2 host (where SSL certificate files do not yet exist), certificate bootstrap follows a clean **two-phase workflow**:

### Phase A: Initial HTTP-Only Setup & Webroot ACME Verification

> [!NOTE]
> **Understanding Phase A Behavior:**
> During Phase A, the active Nginx configuration on Port 80 exists primarily to serve the Let's Encrypt ACME webroot challenge (`/.well-known/acme-challenge/`).
> The HTTPS server block is still commented out. The HTTP `location /` block is configured to return a 301 redirect to HTTPS (which becomes active once Phase B is complete). Therefore, during Phase A, operators should **not** expect the full application or SPA to be accessible over plain HTTP.
>
> The expected lifecycle is:
> 1. **Phase A (Initial Bootstrap)**: `HTTP Port 80` → ACME challenge verification → Certificate issuance.
> 2. **Phase B (Production Live)**: `HTTP Port 80` → Automatic HTTPS redirect → `HTTPS Port 443` (SPA, REST API, WebSockets).

1. **Copy the Nginx configuration template**:
   ```bash
   sudo cp /opt/careerbridge/deploy/nginx/careerbridge.conf.example /etc/nginx/sites-available/careerbridge.conf
   ```

2. **Keep the HTTPS block commented out** (it is commented out by default in the template).

3. **Replace `YOUR_DOMAIN` with your actual domain**:
   ```bash
   sudo sed -i 's/YOUR_DOMAIN/careerbridge.example.com/g' /etc/nginx/sites-available/careerbridge.conf
   ```

4. **Create the Certbot webroot challenge directory**:
   ```bash
   sudo mkdir -p /var/www/certbot
   ```

5. **Enable the HTTP configuration**:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/careerbridge.conf /etc/nginx/sites-enabled/careerbridge.conf
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

6. **Validate Nginx configuration syntax**:
   ```bash
   sudo nginx -t
   ```

7. **Reload Nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

8. **Issue certificate using Certbot Webroot Authenticator**:
   ```bash
   sudo certbot certonly \
     --webroot \
     -w /var/www/certbot \
     -d YOUR_DOMAIN \
     -m YOUR_EMAIL \
     --agree-tos
   ```

9. **Confirm certificate files exist**:
   ```bash
   sudo ls -l /etc/letsencrypt/live/YOUR_DOMAIN/
   # Verify fullchain.pem and privkey.pem are present
   ```

### Phase B: Enable Production HTTPS & WebSockets

10. **Uncomment the HTTPS block**:
    Open `/etc/nginx/sites-available/careerbridge.conf` and uncomment the `server { listen 443 ssl ... }` block (Section 2 of the configuration).

11. **Validate Nginx configuration syntax**:
    ```bash
    sudo nginx -t
    ```

12. **Reload Nginx**:
    ```bash
    sudo systemctl reload nginx
    ```

13. **Verify HTTP-to-HTTPS redirect**:
    ```bash
    curl -I http://YOUR_DOMAIN
    # Expect HTTP/1.1 301 Moved Permanently pointing to https://YOUR_DOMAIN
    ```

---

## 13. Certificate Renewal Automation

Let's Encrypt certificates are valid for 90 days. Certbot installs a systemd timer on Ubuntu that handles automatic background renewals:

```bash
# Verify the Certbot renewal timer is active:
sudo systemctl status certbot.timer

# Test automatic renewal dry-run:
sudo certbot renew --dry-run
```

---

## 14. HTTPS & Security Header Verification

Verify encryption and security headers:

```bash
# Run locally or on EC2:
# 1. Test HTTP-to-HTTPS redirect (Expect HTTP 301)
curl -I http://YOUR_DOMAIN

# 2. Test HTTPS health endpoint (Expect HTTP 200)
curl -I https://YOUR_DOMAIN/health

# 3. Verify security headers
curl -s -I https://YOUR_DOMAIN/health | grep -E -i "x-content-type-options|x-frame-options|referrer-policy"
```

---

## 15. WebSocket Verification

Verify real-time bidirectional WebSocket messaging at `/api/v1/ws/messages`:

1. Obtain a valid JWT access token via login:
   ```bash
   TOKEN=$(curl -s -X POST https://YOUR_DOMAIN/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"student@example.com","password":"YourPassword123!"}' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
   ```
2. Test WebSocket connection:
   ```javascript
   // Run in browser DevTools Console or using a WebSocket client tool:
   const ws = new WebSocket(`wss://YOUR_DOMAIN/api/v1/ws/messages?token=${TOKEN}`);
   ws.onopen = () => console.log("WebSocket connected successfully!");
   ws.onmessage = (e) => console.log("Message received:", e.data);
   ```

---

## 16. Health Checks & Diagnostics

CareerBridge provides standard health and documentation endpoints:

| Endpoint | Method | Expected Output | Purpose |
| :--- | :---: | :---: | :--- |
| `/health` | `GET` | `{"status":"ok","database":"connected","service":"CareerBridge API"}` | Database connectivity & service health probe |
| `/` | `GET` | `{"message":"CareerBridge API","status":"ok"}` | Root API identity |
| `/docs` | `GET` | Swagger UI HTML interface | Interactive API documentation |
| `/redoc` | `GET` | ReDoc HTML interface | Alternative API reference documentation |
| `/openapi.json` | `GET` | OpenAPI 3.1 JSON Specification | Machine-readable API schema |

---

## 17. Rollback Procedure

Production rollbacks must distinguish between application code rollbacks and database schema migrations.

### 1. Application Container Rollback
If a regression occurs in the application code:
1. Check out the previous stable git commit:
   ```bash
   cd /opt/careerbridge
   git checkout <PREVIOUS_STABLE_COMMIT_SHA>
   ```
2. Rebuild frontend assets if frontend code changed:
   ```bash
   cd /opt/careerbridge/frontend
   npm ci && npm run build
   sudo cp -r dist/* /var/www/careerbridge/frontend/
   ```
3. Rebuild and restart the containerized backend:
   ```bash
   cd /opt/careerbridge/backend
   docker compose -f docker-compose.production.yml up -d --build
   ```

### 2. Database Schema Rollback & Recovery Strategy
> [!WARNING]
> **Never execute generic or blind downgrades in production.**
> Application rollback and database rollback are independent operations. Schema downgrades can lead to catastrophic data loss if columns or tables containing production user data are dropped.

Follow these production-safe guidelines:
- **Migration-Specific Evaluation**: Only execute `alembic downgrade` if the specific migration script defines a verified, non-destructive `downgrade()` function and the schema state is fully compatible with the rolled-back application code.
- **Verify Backup Availability First**: Before attempting any schema modification or downgrade, confirm that a recent, verified database backup is immediately available.
- **Backward-Compatible Schema Design**: Design migrations using expand/contract patterns so that older application versions can run alongside newer schemas during rollouts.
- **Database Restore Recovery**: If an unrecoverable schema error occurs, use the documented point-in-time database restore procedure rather than issuing arbitrary downgrades.

---

## 18. Logs Inspection

Monitor system logs on the host:

```bash
# Follow FastAPI backend container logs:
docker compose -f /opt/careerbridge/backend/docker-compose.production.yml logs -f backend

# Follow PostgreSQL container logs:
docker compose -f /opt/careerbridge/backend/docker-compose.production.yml logs -f db

# Inspect Nginx access and error logs:
sudo tail -f /var/log/nginx/careerbridge_access.log
sudo tail -f /var/log/nginx/careerbridge_error.log
```

---

## 19. Backup & Disaster Recovery

CareerBridge stores two distinct classes of persistent production data:
1. **PostgreSQL Database**: User accounts, credentials, job applications, messages, and platform metadata stored in the `careerbridge_postgres_production_data` Docker volume.
2. **Uploaded Files**: User resumes and profile avatars stored in the `careerbridge_uploads_production` Docker volume (mounted at `/app/uploads`).

> [!IMPORTANT]
> The PostgreSQL logical dump (`pg_dump`) backs up relational records only; it does **NOT** back up uploaded resume or avatar files. Both classes of persistent state must be factored into your operational backup strategy.
>
> The repository documents operational backup procedures for reference. It does **not** automatically install scheduled host cron jobs, configure external cloud object storage, or provision AWS Data Lifecycle Manager policies.

### Optional Operational Backup Configuration

#### 1. PostgreSQL Logical Dump (Local Host Procedure)
Operators can establish a local logical backup script at `/opt/careerbridge/backup_db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/opt/careerbridge/backups/db"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
cd /opt/careerbridge/backend

docker compose -f docker-compose.production.yml exec -T db pg_dump -U careerbridge_admin careerbridge_prod | gzip > "$BACKUP_DIR/db_backup_${TIMESTAMP}.sql.gz"

# Retain last 14 days of local backups
find "$BACKUP_DIR" -type f -name "db_backup_*.sql.gz" -mtime +14 -delete
```

#### 2. Upload Volume Backup (Local Host Procedure)
Operators can archive the uploaded file volume (`/app/uploads` from `careerbridge-backend-production`) locally:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/opt/careerbridge/backups/uploads"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create a compressed tarball from the running backend container's mounted uploads volume
docker run --rm \
  --volumes-from careerbridge-backend-production:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar -czf "/backup/uploads_backup_${TIMESTAMP}.tar.gz" -C /app/uploads .

# Retain last 14 days of local archives
find "$BACKUP_DIR" -type f -name "uploads_backup_*.tar.gz" -mtime +14 -delete
```

#### 3. Off-Host Disaster Recovery Notice
> [!CAUTION]
> Backups stored under `/opt/careerbridge/backups` reside strictly on the local EC2 instance EBS volume.
> If the EC2 instance or EBS volume is lost, local backups are lost with it.
> True disaster recovery requires synchronizing backup artifacts to an off-host destination (such as an appropriately secured private Amazon S3 bucket with lifecycle rules) or leveraging AWS Data Lifecycle Manager (DLM) snapshots configured in the AWS Console.

---

## 20. Update & Deployment Procedure

When deploying application updates from git `main`, follow this gated procedure:

```bash
# Run on EC2:
cd /opt/careerbridge

# 1. Pull latest code
git pull origin main

# 2. Rebuild frontend static bundle
cd /opt/careerbridge/frontend
npm ci
npm run build
sudo cp -r dist/* /var/www/careerbridge/frontend/

# 3. Rebuild and restart backend container
cd /opt/careerbridge/backend
docker compose -f docker-compose.production.yml up -d --build

# 4. Verify PostgreSQL container health before migrations (strict bounded health gate)
echo "Verifying database readiness..."
DB_HEALTHY=false
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' careerbridge-db-production 2>/dev/null | tr -d '"' || true)
    if [ "$STATUS" = "healthy" ]; then
        echo "PostgreSQL container is healthy."
        DB_HEALTHY=true
        break
    fi
    echo "Waiting for PostgreSQL health... attempt $i/30 (status: ${STATUS:-starting})"
    sleep 2
done

if [ "$DB_HEALTHY" != "true" ]; then
    echo "ERROR: PostgreSQL did not become healthy within the expected timeout."
    echo "Recent PostgreSQL logs:"
    docker compose -f docker-compose.production.yml logs --tail=100 db
    exit 1
fi

# 5. Apply Alembic migrations and verify migration state (only executed after database health gate passes)
docker compose -f docker-compose.production.yml exec backend alembic upgrade head
docker compose -f docker-compose.production.yml exec backend alembic current

# 6. Verify backend health with a bounded retry loop
echo "Verifying backend readiness at http://127.0.0.1:8000/health..."
BACKEND_HEALTHY=false
for i in {1..30}; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health || echo "FAILED")
    if [ "$CODE" = "200" ]; then
        echo "SUCCESS: Backend update deployed and healthy (HTTP 200)."
        BACKEND_HEALTHY=true
        break
    fi
    echo "Waiting for backend health response (status: ${CODE})... ($i/30)"
    sleep 2
done

if [ "$BACKEND_HEALTHY" != "true" ]; then
    echo "ERROR: Backend health check failed after update!"
    docker compose -f docker-compose.production.yml logs --tail=50 backend
    exit 1
fi
```

---

## 21. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 502 Bad Gateway** | FastAPI container is not running or crashed. | Check container logs: `docker compose -f docker-compose.production.yml logs backend`. Verify port binding `127.0.0.1:8000`. |
| **HTTP 503 Service Unavailable on `/health`** | PostgreSQL container is starting up or unreachable. | Inspect database logs: `docker compose -f docker-compose.production.yml logs db`. Ensure `POSTGRES_PASSWORD` matches in `.env`. |
| **CORS Policy Error in Browser** | `BACKEND_CORS_ORIGINS` in `.env` does not match the frontend origin. | Update `BACKEND_CORS_ORIGINS="https://YOUR_DOMAIN"` in `/opt/careerbridge/backend/.env` and restart backend. |
| **SPA 404 on Page Refresh** | Nginx missing `try_files $uri $uri/ /index.html;`. | Ensure Nginx `location /` includes the SPA fallback rule and reload Nginx. |
| **WebSocket Connection Failed** | Missing `Upgrade` headers or proxy timeouts. | Verify `proxy_set_header Upgrade $http_upgrade;` and `proxy_read_timeout 86400s;` in Nginx config. |
| **Certbot Rate Limit / ACME Error** | DNS not yet pointing to EC2 Elastic IP or port 80 blocked. | Verify DNS resolution with `dig +short YOUR_DOMAIN` and confirm UFW allows port 80 before running `certbot`. |
| **Nginx Syntax Error on First Run** | HTTPS server block enabled before SSL certificate exists. | Keep HTTPS server block commented out until Certbot webroot issuance succeeds in Phase A. |
