#!/usr/bin/env bash
# Deploy Proxo VPN node-agent onto this VPS.
# Run from a machine that can scp, OR copy the repo to the VPS first.
#
# On the VPS (after bootstrap.sh), from the copied monorepo root:
#   sudo bash infra/wireguard/deploy-agent.sh
set -euo pipefail

AGENT_DIR="${AGENT_DIR:-/opt/proxo-vpn/node-agent}"
REPO_ROOT="${REPO_ROOT:-}"
SERVICE_NAME="proxo-vpn-agent"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

# Detect repo root if not provided
if [[ -z "${REPO_ROOT}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi

SRC="${REPO_ROOT}/services/node-agent"
if [[ ! -f "${SRC}/package.json" ]]; then
  echo "Cannot find services/node-agent at ${SRC}"
  echo "Copy the Proxo VPN repo to the VPS, or set REPO_ROOT=/path/to/proxo-vpn"
  exit 1
fi

# Node.js 20+
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

install -d -m 755 "${AGENT_DIR}"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  "${SRC}/" "${AGENT_DIR}/"

cd "${AGENT_DIR}"
npm install --omit=dev
npm install typescript --no-save
npx tsc -p tsconfig.json
rm -rf node_modules/typescript

if [[ ! -f "${AGENT_DIR}/.env" ]]; then
  if [[ -f "${REPO_ROOT}/infra/wireguard/agent.env.example" ]]; then
    cp "${REPO_ROOT}/infra/wireguard/agent.env.example" "${AGENT_DIR}/.env"
  else
    cat > "${AGENT_DIR}/.env" <<EOF
PORT=4100
AGENT_SECRET=change-me
WG_INTERFACE=wg0
WG_SUBNET_PREFIX=10.8.0
WG_MOCK=false
EOF
  fi
  echo "Wrote ${AGENT_DIR}/.env — EDIT AGENT_SECRET before production use."
fi

install -m 644 "${REPO_ROOT}/infra/wireguard/proxo-vpn-agent.service" \
  /etc/systemd/system/${SERVICE_NAME}.service

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"
systemctl --no-pager --full status "${SERVICE_NAME}" || true

echo ""
echo "Agent deployed."
echo "  Health: curl -s http://127.0.0.1:4100/health"
echo "  Edit:   nano ${AGENT_DIR}/.env && systemctl restart ${SERVICE_NAME}"
