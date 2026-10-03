# CareerBridge v1.0.0 — Production Deployment Runbook

**Document Revision:** 1.0  
**Target Platform:** Ubuntu 22.04 LTS / Ubuntu 24.04 LTS Cloud VM  
**Topology:** Single-Node Production Docker Compose (PostgreSQL 16 + FastAPI + Nginx SPA)  
**Release Baseline:** `v1.0.0` (`2b01d8f`)

---

## 1. Prerequisites

Before initiating the deployment process, ensure you have:

- **Target Cloud Server**: Provisioned cloud instance (e.g. AWS EC2 `t3.medium`, DigitalOcean Droplet 4GB, Hetzner Cloud `CPX21`, or Google Cloud Compute Engine `e2-standard-2`).
- **Operating System**: Clean installation of Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (x86_64 or arm64).
- **SSH Credentials**: Dedicated non-root user with `sudo` privileges and public-key authentication configured.
- **Registered Domain Name**: Fully qualified domain name (e.g., `careerbridge.io` or `app.careerbridge.io`).
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
       │  │ - Proxies `/api/*` and `/health` requests             │  │
       │  └──────────────────────────┬────────────────────────────┘  │
       │                             │                               │
       │                             ▼ Internal Docker Network       │
       │  ┌───────────────────────────────────────────────────────┐  │
       │  │ backend container (python:3.11-slim)                  │  │
       │  │ - Unprivileged appuser execution                      │  │
       │  │ - FastAPI / Uvicorn ASGI Server (Port 8000)           │  │
       │  │ - Persistent volume: `/app/uploads`                   │  │
       │  └──────────────────────────┬────────────────────────────┘  │
       │                             │                               │
       │                             ▼ Internal Docker Network       │
       │  ┌───────────────────────────────────────────────────────┐  │
       │  │ db container (postgres:16)                            │  │
       │  │ - Persistent volume: `/var/lib/postgresql/data`       │  │
       │  │ - Bound exclusively to Docker private bridge          │  │
       │  └───────────────────────────────────────────────────────┘  │
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

### Environment Variable Contract Table

| Variable | Requirement | Description | Example / Method to Generate |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | **Required** | Deployment stage identifier | `production` |
| `DEBUG` | **Required** | Disables debug mode and interactive docs | `False` |
| `JWT_SECRET_KEY` | **Required** | High-entropy signing secret for JWT tokens | Generate with: `openssl rand -hex 32` |
| `POSTGRES_DB` | **Required** | Database name | `internship_db` |
| `POSTGRES_USER` | **Required** | Database superuser account name | `postgres` |
| `POSTGRES_PASSWORD` | **Required** | High-entropy database password | Generate with: `openssl rand -hex 24` |
| `GOOGLE_CLIENT_ID` | **Required** | Google OAuth 2.0 Web Client ID | `xxxxxx.apps.googleusercontent.com` |
| `BACKEND_CORS_ORIGINS` | **Required** | Allowed origins for cross-origin requests | `["https://careerbridge.yourdomain.com"]` |
| `VITE_API_BASE_URL` | Optional | Frontend API routing base path | `/api/v1` (Default: same-origin proxy) |
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

## 12. Production Smoke Testing & Verification

Run the automated CareerBridge deployment verification script:

```bash
python scripts/smoke_test.py --backend-url http://127.0.0.1:8000 --frontend-url http://127.0.0.1:80
```

### Manual Probe Verification Checklist
```bash
# 1. Frontend container health
curl -f http://127.0.0.1/nginx-health

# 2. Backend health & PostgreSQL connectivity
curl -f http://127.0.0.1:8000/health

# 3. OpenAPI Schema
curl -f http://127.0.0.1:8000/openapi.json

# 4. SPA Route Resolution
curl -s http://127.0.0.1/app/jobs | grep -q "root" && echo "SPA Route: OK"
```

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
3. **Rebuild and Restart Containers**:
   ```bash
   docker compose -f docker-compose.production.yml up -d --build
   ```
4. **Run Smoke Tests**:
   ```bash
   python scripts/smoke_test.py
   ```

---

## 16. Security Hardening Checklist

- [x] **SSH Hardening**: Password authentication disabled in `/etc/ssh/sshd_config` (`PasswordAuthentication no`), root login disabled (`PermitRootLogin no`).
- [x] **Firewall Isolation**: Only ports 22, 80, 443 permitted. PostgreSQL port 5432 closed to external interfaces.
- [x] **Non-Root Containers**: Backend runs under unprivileged `appuser` (UID 1000), frontend under `nginx`.
- [x] **Brute-Force Protection**: `fail2ban` installed and active for SSH service (`sudo apt-get install fail2ban`).
- [x] **Unattended Security Updates**: Enabled via `sudo apt-get install unattended-upgrades`.
- [x] **Secret Isolation**: `.env` file set to `chmod 600` and excluded from source control.

---

## 17. Troubleshooting & FAQ

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **502 Bad Gateway on `/api/*`** | Backend container starting or crashed | Check backend logs: `docker compose logs backend`. Verify DB is healthy. |
| **Database Connection Refused** | PostgreSQL container still initializing | Verify healthcheck: `docker compose ps db`. Check password in `.env`. |
| **Alembic Target database is not up to date** | Migrations pending | Run `docker compose run --rm backend alembic upgrade head`. |
| **CORS error in browser console** | `BACKEND_CORS_ORIGINS` mismatch | Ensure `.env` includes exact client scheme and domain `["https://yourdomain.com"]`. |
| **Port 80 already in use** | Apache or default Nginx running on host | Stop conflicting service: `sudo systemctl stop apache2 && sudo systemctl disable apache2`. |
| **Resume/Avatar upload fails (413)** | Payload exceeds client max body size | Nginx is configured for 10MB limit; check file size is $\le$ 5MB for PDF, $\le$ 2MB for images. |
