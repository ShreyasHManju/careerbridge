# CareerBridge Low-Cost Deployment Plan & Cloud Strategy

**Date:** 2026-10-19
**Repository Working Copy:** `C:\CareerBridge-Safety-Copy`
**Target Focus:** Cost minimization, reliability, zero unexpected cloud billing, and fail-safe recovery.

---

## 1. Executive Summary & Cost Philosophy

AWS EC2 and managed cloud databases (like RDS) frequently lead to unexpected charges (idle instance charges, IPv4 public address surcharges, NAT gateway bandwidth fees, and persistent EBS storage costs). For CareerBridge, we establish a 3-tier deployment model:

1. **Local Development & Demonstration (₹0 / $0):** Host-based execution or local Docker Compose.
2. **Temporary Preview / Staging (₹0 / $0):** Ephemeral staging environments or Cloudflare Tunnel overlays on local hardware.
3. **Public Production Deployment ($0 – $5/month):** Low-cost VPS (Hetzner Cloud / DigitalOcean / Linode) or ₹0 Self-Hosted Production with Cloudflare Zero Trust tunnel.

---

## 2. Environment Comparison Matrix

| Deployment Tier | Architecture | Compute Provider | Database Strategy | Estimated Monthly Cost | Sleep / Cold Start Behavior | Persistence & Risk Assessment |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **Tier 1: Local Dev & Demo** | Single machine host | Local PC / WSL2 | Local PostgreSQL (port 5432/5435) | **$0.00** | Instant wake; zero latency | Completely local; data persists in named volume or host dir |
| **Tier 2: Self-Hosted Public Demo (Phase 41B)** | Docker Compose + Cloudflare Tunnel | Existing spare laptop, desktop, or homelab NUC | Containerized PostgreSQL 16 on Docker volume | **$0.00** | 24/7 uptime (as long as host is on); no sleep | High speed; zero ingress/egress fees; dependent on home ISP/power |
| **Tier 3A: Ultra-Low-Cost VPS** | Single Docker Compose node | Hetzner Cloud (CAX11 / CX22) or DigitalOcean ($4–$6/mo) | Containerized PostgreSQL 16 on local NVMe | **~$4.00 – $6.00 / mo** | No sleep; 100% active; dedicated IPv4/IPv6 | High reliability; automated snapshot backups; predictable billing |
| **Tier 3B: Managed PaaS (Render / Railway / Fly)** | Managed app container | Render / Railway / Fly.io free or starter tiers | Managed DB (500MB cap) | **$0 (free tier) to $15+/mo** | Free tiers spin down after 15 min inactivity; slow 30s cold start | Free tier databases frequently auto-expire or delete after 30–90 days without payment |
| **Tier 3C: AWS EC2 (Traditional)** | EC2 `t3.micro` / `t3.small` + S3 + RDS | AWS Elastic Compute Cloud | AWS RDS PostgreSQL or EBS-backed container | **$18.00 – $35.00+ / mo** | No sleep; expensive bandwidth & public IP fees ($3.65/mo IPv4 tax) | High enterprise reliability; risk of billing surprise if unmonitored |

---

## 3. Recommended Deployable Architecture: The "Smart Budget" Model

We recommend **Tier 2 (Self-Hosted + Cloudflare Tunnel)** for student demonstrations / pilot launches, transitioning to **Tier 3A (Hetzner / DigitalOcean VPS)** when high public SLA is needed.

### Architecture Blueprint
```
              [ Public Internet Clients ]
                          │
                          ▼ HTTPS (Port 443)
              ┌─────────────────────────┐
              │  Cloudflare Zero Trust  │ (Free SSL/TLS termination, DDoS protection,
              │     Tunnel (cloudflared) │  and zero public IP exposure)
              └───────────┬─────────────┘
                          │ Encrypted outbound tunnel
                          ▼
              ┌─────────────────────────────────────────────────────────┐
              │   Single-Node Docker Compose (VPS or Self-Hosted)       │
              │                                                         │
              │   ┌─────────────────────────────────────────────────┐   │
              │   │ frontend (nginx:alpine)                         │   │
              │   │ - Serves static React/Vite SPA                  │   │
              │   │ - Reverse proxies /api to backend:8000          │   │
              │   └───────────────────────┬─────────────────────────┘   │
              │                           │                             │
              │                           ▼                             │
              │   ┌─────────────────────────────────────────────────┐   │
              │   │ backend (FastAPI/Uvicorn)                       │   │
              │   │ - Runs as non-root user (appuser)               │   │
              │   │ - Enforces production security gate             │   │
              │   └───────┬───────────────────────────────┬─────────┘   │
              │           │                               │             │
              │           ▼                               ▼             │
              │   ┌───────────────┐           ┌─────────────────────┐   │
              │   │ db (pg 16)    │           │ Cloudflare R2 / S3  │   │
              │   │ Named Volume  │           │ (Resumes / Images)  │   │
              │   └───────────────┘           │ 10GB Free Storage   │   │
              │                               └─────────────────────┘   │
              └─────────────────────────────────────────────────────────┘
```

### Why Cloudflare R2 for Storage?
- **Zero Egress Fees:** Unlike AWS S3 which charges $0.09/GB for downloads, Cloudflare R2 charges **$0.00** for egress bandwidth.
- **Generous Free Tier:** 10 GB-months of storage, 1M Class A operations (uploads), and 10M Class B operations (downloads) free every month.
- **S3 API Compatibility:** Works seamlessly with `boto3` in CareerBridge using the existing `S3StorageProvider`.

---

## 4. Disaster Recovery, Backup & Rollback Strategy

1. **Pre-Deployment Database Snapshot:**
   Always run the cold snapshot before running migrations:
   ```bash
   ./scripts/backup_local.ps1
   ```
2. **Automated Database Backups:**
   - A daily cron job executes `pg_dump -Fc` inside the database container.
   - Retain last 7 daily backups and last 4 weekly backups.
   - Encrypt and sync dump to Cloudflare R2 bucket (`careerbridge-backups`).
3. **Rollback Runbook:**
   - If a new deployment fails health checks (`/health/ready` returns 503):
     - Stop updated containers: `docker compose -f docker-compose.production.yml down`
     - Revert to previous release image tag in `docker-compose.production.yml`.
     - If schema was altered, execute `restore_local.ps1` to restore the pre-migration snapshot.
     - Bring previous release back up: `docker compose -f docker-compose.production.yml up -d`

---

## 5. Explicit Safety Rules for Cloud Deployment

- **Rule 1:** Never store AWS root credentials or full-access IAM keys on the server. Use scoped IAM users or Cloudflare R2 API tokens limited to a single bucket.
- **Rule 2:** Never expose PostgreSQL port 5432 directly to `0.0.0.0` on the public internet. Keep PostgreSQL internal to the Docker bridge network.
- **Rule 3:** Enable Cloudflare Web Application Firewall (WAF) rate limiting to mitigate DDoS attacks.
- **Rule 4:** Do not rely on ephemeral PaaS free tiers for mission-critical student records.
