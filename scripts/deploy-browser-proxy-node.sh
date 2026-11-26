#!/usr/bin/env bash
# Update NYC (or any) VPS node-agent with HTTPS CONNECT proxy for the Chrome extension.
# TLS hides CONNECT destination hostnames from ISP DPI (adult sites, etc.).
# Usage:
#   VPS_HOST=64.176.207.48 bash scripts/deploy-browser-proxy-node.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-64.176.207.48}"
SSH_TARGET="${SSH_TARGET:-root@${VPS_HOST}}"
REMOTE_SRC="${REMOTE_SRC:-/opt/proxo-vpn/src}"
HTTP_PROXY_PORT="${HTTP_PROXY_PORT:-8080}"
HTTPS_PROXY_PORT="${HTTPS_PROXY_PORT:-8443}"
# Hostname must match the TLS certificate (sslip.io maps to the VPS IP).
PROXY_PUBLIC_HOST="${PROXY_PUBLIC_HOST:-${VPS_HOST}.sslip.io}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-info@globalseocreativeltd.com}"

echo "Syncing $ROOT → $SSH_TARGET:$REMOTE_SRC"
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude '.env' \
  --exclude 'node-agent/node_modules' \
  --exclude 'node-agent/dist' \
  "$ROOT/" "$SSH_TARGET:$REMOTE_SRC/"

ssh -o BatchMode=yes "$SSH_TARGET" \
  "REMOTE_SRC='$REMOTE_SRC' HTTP_PROXY_PORT='$HTTP_PROXY_PORT' HTTPS_PROXY_PORT='$HTTPS_PROXY_PORT' PROXY_PUBLIC_HOST='$PROXY_PUBLIC_HOST' LETSENCRYPT_EMAIL='$LETSENCRYPT_EMAIL' bash -s" <<'REMOTE'
set -euo pipefail
ENV=/opt/proxo-vpn/node-agent/.env
CERT_DIR="/etc/letsencrypt/live/${PROXY_PUBLIC_HOST}"
mkdir -p /opt/proxo-vpn/node-agent

# Ensure certbot + open ACME + proxy ports
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq certbot >/dev/null
ufw allow 80/tcp comment 'ACME HTTP-01' || true
ufw allow "${HTTP_PROXY_PORT}/tcp" comment 'Browser HTTP proxy' || true
ufw allow "${HTTPS_PROXY_PORT}/tcp" comment 'Browser HTTPS proxy' || true

if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
  echo "Issuing Let's Encrypt cert for ${PROXY_PUBLIC_HOST}..."
  # Stop anything on :80 briefly if needed; standalone is fine on this node.
  certbot certonly --standalone \
    --non-interactive --agree-tos \
    -m "${LETSENCRYPT_EMAIL}" \
    -d "${PROXY_PUBLIC_HOST}" \
    --preferred-challenges http
fi

# Keep certs readable by the agent process (runs as root on this node).
chmod 755 /etc/letsencrypt/live /etc/letsencrypt/archive || true

if [[ -f "$ENV" ]]; then
  upsert() {
    local key="$1" val="$2"
    if grep -q "^${key}=" "$ENV"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV"
    else
      echo "${key}=${val}" >> "$ENV"
    fi
  }
  upsert PROXY_ENABLED true
  upsert HTTP_PROXY_PORT "${HTTP_PROXY_PORT}"
  upsert HTTPS_PROXY_PORT "${HTTPS_PROXY_PORT}"
  upsert SOCKS_PORT 1080
  upsert PROXY_PUBLIC_HOST "${PROXY_PUBLIC_HOST}"
  upsert PROXY_TLS_CERT "${CERT_DIR}/fullchain.pem"
  upsert PROXY_TLS_KEY "${CERT_DIR}/privkey.pem"
fi

cd "$REMOTE_SRC"
REPO_ROOT="$REMOTE_SRC" bash infra/wireguard/deploy-agent.sh
sleep 2
echo "== health =="
curl -fsS http://127.0.0.1:4100/health
echo
echo "== listeners =="
ss -lntp | grep -E "4100|${HTTP_PROXY_PORT}|${HTTPS_PROXY_PORT}|1080" || true
REMOTE

echo ""
echo "Done. From your Mac verify:"
echo "  curl -s http://${VPS_HOST}:4100/health | python3 -m json.tool"
echo "  # expect proxy.tls=true, advertiseScheme=https, advertisePort=${HTTPS_PROXY_PORT}"
