#!/usr/bin/env bash
# ==============================================================================
# CareerBridge — Ubuntu Cloud Host Bootstrap Script
# Target: Ubuntu 22.04 LTS / 24.04 LTS (AWS EC2 / Cloud VM)
#
# Idempotently installs:
# 1. System packages & security updates
# 2. UFW firewall (22/SSH, 80/HTTP, 443/HTTPS)
# 3. fail2ban brute-force protection
# 4. Official Docker Engine & Docker Compose plugin
# 5. Docker daemon log rotation configuration
# 6. Swapfile (2GB) for memory protection
# 7. Deployment directory (/opt/careerbridge)
#
# Usage:
#   sudo ./bootstrap-ubuntu.sh
# ==============================================================================

set -Eeuo pipefail

trap 'echo "[ERROR] Bootstrap failed on line $LINENO" >&2' ERR

# Require root privileges
if [[ $EUID -ne 0 ]]; then
    echo "[ERROR] This bootstrap script must be run as root (or with sudo)." >&2
    exit 1
fi

TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "ubuntu")}"
DEPLOY_DIR="/opt/careerbridge"

echo "=========================================================================="
echo "CAREERBRIDGE — UBUNTU HOST BOOTSTRAP"
echo "=========================================================================="
echo "Target User       : ${TARGET_USER}"
echo "Deployment Path   : ${DEPLOY_DIR}"
echo "Timestamp         : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================================================="

# 1. Update system package index and install base utilities
echo "[1/7] Updating package index and installing base utilities..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    git \
    ufw \
    fail2ban \
    unattended-upgrades \
    htop \
    jq

# 2. Configure UFW Firewall
echo "[2/7] Configuring UFW host firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Administrative Access'
ufw allow 80/tcp comment 'HTTP Web Traffic'
ufw allow 443/tcp comment 'HTTPS Encrypted Web Traffic'
# Explicitly confirm internal ports are not exposed
ufw deny 5432/tcp comment 'Block PostgreSQL from public' >/dev/null 2>&1 || true
ufw deny 8000/tcp comment 'Block FastAPI from public' >/dev/null 2>&1 || true
ufw --force enable
echo "  -> UFW firewall configured and active."

# 3. Configure fail2ban
echo "[3/7] Enabling fail2ban for SSH brute-force protection..."
systemctl enable --now fail2ban

# 4. Install official Docker Engine & Docker Compose plugin
echo "[4/7] Installing official Docker Engine..."
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="$(lsb_release -cs)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

systemctl enable --now docker

# 5. Configure Docker log rotation
echo "[5/7] Configuring Docker daemon log rotation..."
mkdir -p /etc/docker
cat << 'EOF' > /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
EOF
systemctl restart docker

# Add deploy user to docker group
if id "${TARGET_USER}" >/dev/null 2>&1; then
    usermod -aG docker "${TARGET_USER}"
    echo "  -> Added ${TARGET_USER} to docker group."
fi

# 6. Configure 2GB Swapfile (if no swap active)
echo "[6/7] Checking swapfile allocation..."
SWAP_TOTAL="$(free -m | awk '/^Swap:/ {print $2}')"
if [[ "${SWAP_TOTAL}" -eq 0 ]]; then
    echo "  -> Creating 2GB swapfile at /swapfile..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo "  -> Swapfile created and mounted."
else
    echo "  -> Swap is already active (${SWAP_TOTAL} MB)."
fi

# 7. Set up deployment directory
echo "[7/7] Initializing deployment directory at ${DEPLOY_DIR}..."
mkdir -p "${DEPLOY_DIR}"
chown -R "${TARGET_USER}:${TARGET_USER}" "${DEPLOY_DIR}"

echo "=========================================================================="
echo "[SUCCESS] Host bootstrap completed successfully!"
echo "Next step: Clone repository and execute deploy/aws/deploy.sh"
echo "=========================================================================="
