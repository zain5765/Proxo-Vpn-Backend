#!/usr/bin/env bash
# Bring up the first REAL WireGuard node on a VPS and register it with the API.
#
# Prerequisites:
#   - Fresh Ubuntu 22.04/24.04 VPS with public IPv4 + root SSH
#   - API running locally (or set API_URL to Heroku)
#
# Usage:
#   VPS_HOST=203.0.113.10 bash scripts/bring-up-first-node.sh
#
# Optional:
#   SSH_USER=root
#   API_URL=http://127.0.0.1:4000/v1
#   ADMIN_KEY=...
#   AGENT_SECRET=...   # must match API NODE_AGENT_SECRET
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="${VPS_HOST:?Set VPS_HOST to the VPS public IPv4}"
SSH_USER="${SSH_USER:-root}"
SSH_TARGET="${SSH_USER}@${VPS_HOST}"
REMOTE_SRC="${REMOTE_SRC:-/opt/proxo-vpn/src}"
API_URL="${API_URL:-http://127.0.0.1:4000/v1}"
ADMIN_KEY="${ADMIN_KEY:-horse-admin-dev}"
AGENT_SECRET="${AGENT_SECRET:-change-me-node-agent-secret}"
NAME="${NAME:-First Node}"
CITY="${CITY:-Amsterdam}"
COUNTRY="${COUNTRY:-NL}"
REGION="${REGION:-eu-test}"

echo "==> 1/5 Copy backend + wireguard toolkit to ${SSH_TARGET}:${REMOTE_SRC}"
ssh -o StrictHostKeyChecking=accept-new "${SSH_TARGET}" "mkdir -p '${REMOTE_SRC}'"
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .env \
  "${ROOT}/" "${SSH_TARGET}:${REMOTE_SRC}/"

echo "==> 2/5 Bootstrap WireGuard"
ssh "${SSH_TARGET}" "bash '${REMOTE_SRC}/infra/wireguard/bootstrap.sh'" | tee /tmp/proxo-wg-bootstrap.txt
PUBLIC_KEY="$(awk -F': ' '/Public key:/{print $2; exit}' /tmp/proxo-wg-bootstrap.txt | tr -d '[:space:]')"
PUBLIC_IP="$(awk -F': ' '/Public IP:/{print $2; exit}' /tmp/proxo-wg-bootstrap.txt | tr -d '[:space:]')"
PUBLIC_IP="${PUBLIC_IP:-$VPS_HOST}"
if [[ -z "${PUBLIC_KEY}" ]]; then
  echo "Could not parse WireGuard public key from bootstrap output"
  exit 1
fi
echo "    WG public key: ${PUBLIC_KEY}"
echo "    Public IP:     ${PUBLIC_IP}"

echo "==> 3/5 Firewall (UDP 51820 + agent 4100)"
# For first bring-up allow agent from anywhere; tighten later to API egress IP.
ssh "${SSH_TARGET}" "API_CIDR=0.0.0.0/0 bash '${REMOTE_SRC}/infra/wireguard/firewall.sh'"

echo "==> 4/5 Deploy node-agent (real WireGuard, not mock)"
ssh "${SSH_TARGET}" "REPO_ROOT='${REMOTE_SRC}' bash '${REMOTE_SRC}/infra/wireguard/deploy-agent.sh'"
ssh "${SSH_TARGET}" "cat > /opt/proxo-vpn/node-agent/.env <<EOF
PORT=4100
AGENT_SECRET=${AGENT_SECRET}
WG_INTERFACE=wg0
WG_SUBNET_PREFIX=10.8.0
WG_MOCK=false
EOF
systemctl restart proxo-vpn-agent 2>/dev/null || systemctl restart horse-vpn-agent
bash '${REMOTE_SRC}/infra/wireguard/verify-node.sh' || true
"

# Service name may still be horse-vpn-agent from older unit file — normalize check
ssh "${SSH_TARGET}" "systemctl is-active proxo-vpn-agent 2>/dev/null || systemctl is-active horse-vpn-agent"

echo "==> 5/5 Register server in API (${API_URL})"
API_URL="${API_URL}" \
ADMIN_KEY="${ADMIN_KEY}" \
ENDPOINT_HOST="${PUBLIC_IP}" \
PUBLIC_KEY="${PUBLIC_KEY}" \
AGENT_BASE_URL="http://${PUBLIC_IP}:4100" \
NAME="${NAME}" CITY="${CITY}" COUNTRY="${COUNTRY}" REGION="${REGION}" \
PREMIUM_ONLY=false \
  bash "${ROOT}/infra/wireguard/register-server.sh"

echo ""
echo "============================================"
echo " First real node is up"
echo "============================================"
echo " VPS:        ${PUBLIC_IP}"
echo " WireGuard:  UDP 51820"
echo " Agent:      http://${PUBLIC_IP}:4100/health"
echo ""
echo " Next on your Mac (API .env):"
echo "   DEFAULT_AGENT_URL=http://${PUBLIC_IP}:4100"
echo "   NODE_AGENT_SECRET=${AGENT_SECRET}"
echo "   ALLOW_CONNECT_WITHOUT_AGENT=false"
echo " Then restart API, rebuild the app, Connect, and check https://ifconfig.me"
echo " (exit IP should become ${PUBLIC_IP})"
