# CareerBridge — AWS EC2 Automation Suite

This directory contains production deployment, rollback, backup, and health verification scripts for deploying **CareerBridge v1.0.0** to an Ubuntu 22.04 / 24.04 LTS cloud VM (AWS EC2).

---

## 1. Directory Structure

```
deploy/aws/
├── README.md               # Operations & automation guide (this document)
├── bootstrap-ubuntu.sh     # Host provisioning: Docker, UFW firewall, fail2ban, swapfile
├── deploy.sh               # Main deployment pipeline: env check, migrations, compose build, healthcheck
├── rollback.sh             # Safe rollback: pre-rollback backup, git checkout, restart
├── backup.sh               # PostgreSQL snapshot (pg_dump + gzip) & optional S3 sync
└── healthcheck.sh          # Endpoint validation (/health, /nginx-health, /openapi.json, SPA)
```

---

## 2. Local Validation vs. Live AWS Deployment

> [!IMPORTANT]
> **Local Environment**: These scripts can be syntax-checked (`bash -n deploy/aws/*.sh`) and reviewed locally without connecting to AWS or modifying any remote infrastructure.
> 
> **Live AWS Deployment**: Executing live deployment requires an actual AWS EC2 instance (`t3.medium`), Elastic IP, Security Group (Inbound 22/80/443), registered domain, production secrets, Google OAuth 2.0 Web Client ID, and SMTP credentials.

---

## 3. Script Usage Guide

### A. Initial Host Setup (`bootstrap-ubuntu.sh`)
Run once on a freshly launched Ubuntu EC2 instance:
```bash
sudo ./deploy/aws/bootstrap-ubuntu.sh
```
**Actions performed:**
- Installs base utilities, `ufw`, `fail2ban`, `unattended-upgrades`.
- Configures UFW firewall: allows 22 (SSH), 80 (HTTP), 443 (HTTPS); blocks 5432 and 8000.
- Installs official Docker Engine and Compose plugin.
- Configures 2GB swapfile for memory protection on 4GB instances.
- Sets up `/opt/careerbridge` deployment directory.

---

### B. Standard Deployment (`deploy.sh`)
Deploy or update the application to a specific release tag:
```bash
cd /opt/careerbridge
./deploy/aws/deploy.sh v1.0.0
```
**Pipeline steps:**
1. Verifies Docker runtime & Docker Compose plugin.
2. Validates production `.env` file and ensures no default placeholder passwords remain.
3. Validates `docker-compose.production.yml` syntax.
4. Validates and checks out specified Git tag.
5. Starts PostgreSQL and waits for healthcheck probe.
6. Executes `alembic upgrade head` migrations.
7. Builds and starts production containers in detached mode.
8. Runs health checks against `/health`, `/nginx-health`, `/openapi.json`, and `/app/jobs`.

---

### C. Health Check Probe (`healthcheck.sh`)
Manually probe running container endpoints:
```bash
./deploy/aws/healthcheck.sh
```

---

### D. Automated PostgreSQL Backup (`backup.sh`)
Take a timestamped, gzip-compressed snapshot:
```bash
./deploy/aws/backup.sh
```
To enable off-host S3 sync, set `S3_BACKUP_BUCKET`:
```bash
S3_BACKUP_BUCKET=careerbridge-backups-production ./deploy/aws/backup.sh
```
**Recommended Cron Entry (`crontab -e`):**
```cron
0 2 * * * cd /opt/careerbridge && ./deploy/aws/backup.sh >> /var/log/careerbridge_backup.log 2>&1
```

---

### E. Production Rollback (`rollback.sh`)
Roll back application code to a prior release tag:
```bash
# Roll back code without schema downgrade (creates mandatory safety backup first)
./deploy/aws/rollback.sh v0.9.0

# Roll back code with specific schema downgrade revision
./deploy/aws/rollback.sh v0.9.0 e8a3182b8a21
```

---

## 4. Security & Safety Principles

1. **Zero Committed Secrets**: Never commit `.env` or credentials to Git.
2. **File Permissions**: Ensure `.env` is set to `chmod 600` and backups to `chmod 600` / `700`.
3. **IAM Least Privilege**: Use EC2 IAM Instance Profiles for S3 backup access instead of hardcoded AWS access keys.
4. **Network Isolation**: PostgreSQL (Port 5432) and FastAPI (Port 8000) remain strictly internal to the Docker network.
5. **Non-Destructive Operations**: Database schema downgrade is never automatic; rollback halts immediately if safety backups fail.
