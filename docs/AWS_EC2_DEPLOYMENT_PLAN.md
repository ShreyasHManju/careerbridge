# CareerBridge v1.0.0 — AWS EC2 Deployment Design & Architecture Plan

**Platform:** CareerBridge — Student Internship & Job Platform  
**Target Environment:** Amazon Web Services (AWS) — Elastic Compute Cloud (EC2)  
**Baseline Release:** `v1.0.0` (`2b01d8f`)  
**Design Status:** Certified Architectural Design (Pre-Provisioning)  
**Related Documents:**
- [`docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [`docs/PRODUCTION_RELEASE_CHECKLIST.md`](PRODUCTION_RELEASE_CHECKLIST.md)

---

## 1. AWS Target Architecture

```
                                [ Internet Users / Browsers ]
                                              │
                                              ▼ Port 53 (DNS Query)
                                ┌───────────────────────────┐
                                │   Amazon Route 53 / DNS   │
                                │   (A Record: @ / www)     │
                                └─────────────┬─────────────┘
                                              │
                                              ▼ Port 443 (HTTPS) / 80 (HTTP)
                                ┌───────────────────────────┐
                                │      AWS Elastic IP       │
                                └─────────────┬─────────────┘
                                              │
                                              ▼
              ┌───────────────────────────────────────────────────────────────┐
              │                   AWS EC2 Instance (Ubuntu)                   │
              │                                                               │
              │   ┌───────────────────────────────────────────────────────┐   │
              │   │ Host Security Group: Inbound 22 (SSH), 80, 443        │   │
              │   └───────────────────────────┬───────────────────────────┘   │
              │                               │                               │
              │   ┌───────────────────────────▼───────────────────────────┐   │
              │   │ Host Nginx + Let's Encrypt TLS (Certbot)              │   │
              │   │ (Terminates SSL, forces HTTPS redirect)               │   │
              │   └───────────────────────────┬───────────────────────────┘   │
              │                               │ Proxy to 127.0.0.1:80         │
              │   ┌───────────────────────────▼───────────────────────────┐   │
              │   │ Docker Compose Production Network                     │   │
              │   │                                                       │   │
              │   │  ┌─────────────────────────────────────────────────┐  │   │
              │   │  │ frontend container (nginx:alpine)               │  │   │
              │   │  │ - Serves React SPA bundles                      │  │   │
              │   │  │ - SPA fallback to /index.html                   │  │   │
              │   │  │ - Proxies /api/* to backend:8000                │  │   │
              │   │  └────────────────────────┬────────────────────────┘  │   │
              │   │                           │                           │   │
              │   │                           ▼ Private Docker Bridge     │   │
              │   │  ┌─────────────────────────────────────────────────┐  │   │
              │   │  │ backend container (python:3.11-slim)            │  │   │
              │   │  │ - FastAPI / Uvicorn (appuser)                   │  │   │
              │   │  │ - Uploads persistent volume (/app/uploads)      │  │   │
              │   │  └────────────────────────┬────────────────────────┘  │   │
              │   │                           │                           │   │
              │   │                           ▼ Private Docker Bridge     │   │
              │   │  ┌─────────────────────────────────────────────────┐  │   │
              │   │  │ db container (postgres:16)                      │  │   │
              │   │  │ - Persistent EBS volume (/var/lib/postgresql)   │  │   │
              │   │  └─────────────────────────────────────────────────┘  │   │
              │   └───────────────────────────────────────────────────────┘   │
              └───────────────────────────────────────────────────────────────┘
```

### Port Exposure & Network Isolation Contract

| Port | Protocol | Scope | Exposure | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **22** | TCP | SSH | Restricted to Admin IP / Bastion | Remote administration via SSH key authentication |
| **80** | TCP | HTTP | Public (`0.0.0.0/0`) | ACME challenge verification & immediate 301 redirect to HTTPS |
| **443** | TCP | HTTPS | Public (`0.0.0.0/0`) | Encrypted user traffic to Nginx reverse proxy |
| **8000** | TCP | HTTP | **Private / Internal Only** | FastAPI backend API; only reachable from Nginx container |
| **5432** | TCP | PostgreSQL | **Private / Internal Only** | PostgreSQL database; strictly confined to Docker bridge |

---

## 2. EC2 Instance Recommendation

For CareerBridge v1.0.0 initial production release:

| Parameter | `t3.small` | `t3.medium` (**Recommended**) |
| :--- | :--- | :--- |
| **vCPU** | 2 (Burstable) | 2 (Burstable) |
| **RAM** | 2.0 GiB | **4.0 GiB** |
| **Network Performance** | Up to 5 Gbps | Up to 5 Gbps |
| **EBS Bandwidth** | Up to 2,085 Mbps | Up to 2,085 Mbps |
| **Workload Fit** | Tight for combined Docker + PostgreSQL | **Optimal headroom for PostgreSQL 16 + FastAPI + Nginx + OS** |

### Recommendation Rationale:
`t3.medium` is recommended for initial deployment because:
1. **Memory Safety**: PostgreSQL 16 buffer pools, FastAPI worker memory, Python runtime, and Nginx caching require approximately 2.2–2.8 GB under steady student/recruiter traffic. A 2.0 GB `t3.small` risks invoking the Linux Out-Of-Memory (OOM) killer during concurrent requests or database indexing.
2. **CPU Burst Credits**: `t3.medium` accumulates 24 CPU credits/hour (vs. 12 on `t3.small`), ensuring resilient performance spikes during peak campus recruiting hours.

---

## 3. Storage Architecture (EBS)

| Volume | Type | Size | Filesystem | Mount / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Root Volume** | Amazon EBS `gp3` | 40 GiB | `ext4` | OS (`/`), Docker Engine, images, container layers, logs |
| **PostgreSQL Data** | Docker Volume (`gp3` backed) | Managed | `ext4` | `/var/lib/docker/volumes/...` (`careerbridge_postgres_production_data`) |
| **Uploads Storage** | Docker Volume (`gp3` backed) | Managed | `ext4` | Student resumes (PDF $\le$ 5MB) & avatars (`careerbridge_uploads_production`) |

### Storage Sizing Rationale:
- OS & Docker images: ~8–12 GB
- Database data (100,000 users, applications, postings): ~5–8 GB initial allocation
- Resumes & profile images (10,000 students @ 500 KB average): ~5 GB
- System swapfile & log retention: ~6 GB
- Buffer headroom: ~9–14 GB
- **Total: 40 GiB gp3 (3,000 IOPS / 125 MB/s baseline at lowest cost tier)**.

---

## 4. Security Group Design

Create a dedicated AWS Security Group: `careerbridge-production-sg`

### Inbound Rules (Ingress)

| Type | Protocol | Port Range | Source | Description |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `YOUR_ADMIN_IP/32` (or Corporate VPN /24) | Operator administrative access only |
| **HTTP** | TCP | `80` | `0.0.0.0/0` (Anywhere IPv4) & `::/0` (IPv6) | Let's Encrypt ACME challenge & HTTPS redirection |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` (Anywhere IPv4) & `::/0` (IPv6) | Production encrypted web application traffic |

### Inbound Rules Explicitly Disallowed (Blocked)
- **Port 5432 (PostgreSQL)**: Must **NEVER** be added to the security group ingress.
- **Port 8000 (FastAPI)**: Must **NEVER** be exposed to public ingress.

### Outbound Rules (Egress)
- All traffic (`0.0.0.0/0`, all protocols/ports) allowed for OS package updates, Docker image pulls, Let's Encrypt renewal, and SMTP email relay.

---

## 5. IAM & Credentials Strategy (Least Privilege)

- **Zero Long-Lived Access Keys on Host**: Never store `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` inside `.env` or in files on the EC2 instance.
- **IAM Role & Instance Profile**: Create an IAM Role `CareerBridgeEC2Role` attached to the EC2 instance:
  - Policy: `AmazonSSMManagedInstanceCore` (enables AWS Systems Manager Session Manager for secure browser-based terminal access without opening SSH port 22).
  - Policy: `CareerBridgeBackupS3Policy` (grants restricted `s3:PutObject` permissions to a dedicated encrypted backup S3 bucket for off-host disaster recovery).

---

## 6. SSH & Key Pair Management

1. **Key Pair Creation**:
   - Create an `ed25519` key pair in the AWS EC2 Console: `careerbridge-deploy-key`.
   - Save the private key locally as `~/.ssh/careerbridge-deploy-key.pem`.
2. **Permission Hardening**:
   ```bash
   chmod 600 ~/.ssh/careerbridge-deploy-key.pem
   ```
3. **Connection Syntax**:
   ```bash
   ssh -i ~/.ssh/careerbridge-deploy-key.pem ubuntu@<ELASTIC_IP>
   ```
4. **Host SSH Security Hardening**:
   - In `/etc/ssh/sshd_config`:
     ```
     PasswordAuthentication no
     PermitRootLogin no
     PubkeyAuthentication yes
     ```
   - Restart SSH daemon: `sudo systemctl restart ssh`
   - Install and enable `fail2ban` for automated brute-force IP bans.

---

## 7. Domain & DNS Strategy

### DNS Record Mapping Table

| Domain / Host | Type | Target Value | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `careerbridge.yourdomain.com` (or `@`) | **A** | `AWS_ELASTIC_IP` | 300s | Apex/subdomain primary routing |
| `www.careerbridge.yourdomain.com` | **CNAME** / **A** | `careerbridge.yourdomain.com` (or Elastic IP) | 300s | Canonical www redirect |

### Provider Options:
- **Option A (Amazon Route 53)**: Managed DNS zone hosted directly within the AWS account; provides integrated health checks and alias records.
- **Option B (External DNS — Cloudflare, Namecheap, GoDaddy)**: Set standard `A` records pointing directly to the AWS Elastic IP.

---

## 8. Elastic IP Allocation

- **Purpose**: Standard EC2 public IPv4 addresses change whenever an instance is stopped and started. An AWS Elastic IP provides a static, persistent public IPv4 address that ensures DNS records remain permanently valid across instance reboots and maintenance cycles.
- **Cost Efficiency**: Elastic IPs are free when attached to a running EC2 instance. AWS charges only when an Elastic IP is allocated but unattached to a running instance.

---

## 9. HTTPS & TLS Architecture

### Let's Encrypt / Certbot Setup
1. Host Nginx serves port 80 and handles domain validation.
2. Certbot requests certificates from Let's Encrypt Certificate Authority.
3. Automated renewal via systemd timer (`certbot.timer`) runs twice daily:
   ```bash
   sudo certbot renew --dry-run
   ```
4. Strict Transport Security (HSTS) and modern TLS 1.2/1.3 ciphers configured in host Nginx.

---

## 10. Database Strategy: EC2 Containerized DB vs. Amazon RDS

| Evaluation Metric | Option A: PostgreSQL on EC2 (Docker) (**Recommended for v1.0.0**) | Option B: Amazon RDS PostgreSQL 16 |
| :--- | :--- | :--- |
| **Cost** | Included in EC2 compute & EBS storage cost ($0 extra) | Additional ~$18–$35/month (db.t4g.micro / small) |
| **Operational Complexity** | Low (managed via `docker-compose.production.yml`) | Moderate (requires VPC subnets, RDS security groups) |
| **Automated Backups** | Managed via `backup_db.sh` + S3 sync cron | Managed automated point-in-time recovery |
| **Resource Isolation** | Shares CPU/RAM with backend & frontend | Fully isolated database memory & CPU |
| **Migration Path** | Standard `pg_dump` $\to$ `pg_restore` to RDS anytime | Direct connection string update in `.env` |

### Decision for Release v1.0.0:
**Option A (PostgreSQL inside Docker on EC2)** is recommended for the initial launch because it minimizes initial infrastructure overhead, maintains 100% parity with the verified local/staging Docker Compose topology, and keeps total operational costs lean. Upgrading to Amazon RDS in a later phase requires only updating the `DATABASE_URL` in `.env`.

---

## 11. Backup Strategy & Disaster Recovery

1. **Daily Database Snapshot**:
   - Scheduled cron job executes [`backend/scripts/backup_db.sh`](../backend/scripts/backup_db.sh) daily at 02:00 UTC.
   - Generates clean, timestamped SQL dump via `docker exec careerbridge-db-production pg_dump`.
2. **Off-Host S3 Replication**:
   - Sync encrypted backups to private S3 bucket:
     ```bash
     aws s3 sync /opt/careerbridge/backups/ s3://careerbridge-backups-production/db/ --sse AES256
     ```
3. **Uploads Snapshot**:
   - Daily rsync/S3 sync of `/var/lib/docker/volumes/careerbridge_uploads_production` for student resumes and avatar images.
4. **Retention Policy**:
   - Local: Prune files older than 14 days.
   - S3: S3 Lifecycle Rule to transition backups to Glacier after 30 days and delete after 90 days.
5. **Restore Verification**:
   - Monthly dry-run restore validation using [`backend/scripts/restore_db.sh`](../backend/scripts/restore_db.sh).

---

## 12. Monitoring & Observability Strategy

### Layer 1: Zero-Cost / Built-In Monitoring (Immediate)
- **Container Health Probes**: `docker compose ps` monitors internal health status for DB, Backend, and Nginx.
- **Application & Access Logs**: Real-time log inspection via `docker compose logs -f --tail=100`.
- **System Metrics**: `htop`, `df -h`, and `free -m` for CPU, RAM, and disk utilization.
- **External Uptime Monitoring**: Free external HTTP check (e.g. UptimeRobot, BetterUptime) probing `https://careerbridge.yourdomain.com/health` every 60 seconds.

### Layer 2: CloudWatch Integration (Optional Enhancement)
- AWS CloudWatch Agent installed on EC2 to export RAM usage and disk utilization metrics.
- CloudWatch Billing Alarm: Trigger alert when estimated charges exceed budget threshold.

---

## 13. Pre-Deployment Cost Safety Checklist

- [ ] **EC2 Sizing**: `t3.medium` instance selected in appropriate region.
- [ ] **EBS Volume**: Single 40 GiB `gp3` root volume provisioned.
- [ ] **Elastic IP**: Allocated and immediately associated with the running EC2 instance.
- [ ] **AWS Billing Alarm**: Configured in CloudWatch (e.g., alert at $25/month).
- [ ] **AWS Cost Explorer**: Enabled in AWS Billing Dashboard.
- [ ] **Data Transfer**: Standard outbound traffic budget monitored.

---

## 14. Step-by-Step EC2 Deployment Execution Plan

When ready to execute the live deployment:

1. **AWS Console**: Create `careerbridge-deploy-key` (Ed25519) and save key file locally (`chmod 600`).
2. **AWS Console**: Create Security Group `careerbridge-production-sg` (Ingress 22 from Admin IP, 80/443 from `0.0.0.0/0`).
3. **AWS Console**: Launch `t3.medium` EC2 instance with Ubuntu 22.04 LTS and 40 GiB `gp3` storage.
4. **AWS Console**: Allocate an Elastic IP and associate it with the new EC2 instance.
5. **DNS Registrar**: Point domain `A` records (`@` and `www`) to the Elastic IP.
6. **SSH Connection**: Connect to instance (`ssh -i ~/.ssh/careerbridge-deploy-key.pem ubuntu@<ELASTIC_IP>`).
7. **Host Setup**: Run `sudo apt update && sudo apt upgrade -y`.
8. **Docker Install**: Install Docker Engine and Docker Compose plugin as documented in [`docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](PRODUCTION_DEPLOYMENT_RUNBOOK.md).
9. **Firewall**: Configure and enable UFW (`ufw allow 22/tcp`, `ufw allow 80/tcp`, `ufw allow 443/tcp`).
10. **Repository Clone**: Clone repository to `/opt/careerbridge` and check out `v1.0.0`.
11. **Environment Injection**: Create `/opt/careerbridge/.env` with high-entropy `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `GOOGLE_CLIENT_ID`, and domain CORS settings.
12. **Database Migration**: Run `docker compose -f docker-compose.production.yml run --rm backend alembic upgrade head`.
13. **Start Application**: Execute `docker compose -f docker-compose.production.yml up -d --build`.
14. **TLS / HTTPS**: Install host Nginx + Certbot and issue Let's Encrypt certificate.
15. **Smoke Verification**: Run `python scripts/smoke_test.py` to confirm all endpoints return HTTP 200.
16. **Backup Setup**: Add daily cron entry for `backup_db.sh`.
17. **Monitoring Setup**: Configure external uptime probe on `/health`.

---

## 15. Sign-Off & Release Reference

- **Release Tag**: `v1.0.0`
- **Git Commit**: `2b01d8f` (Merged to `origin/main`)
- **Operations Runbook**: [`docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- **Pre-Flight Checklist**: [`docs/PRODUCTION_RELEASE_CHECKLIST.md`](PRODUCTION_RELEASE_CHECKLIST.md)
