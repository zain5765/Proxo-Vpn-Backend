#!/usr/bin/env bash
# Update NYC (or any) VPS node-agent with HTTP CONNECT proxy for the Chrome extension.
# Usage:
#   VPS_HOST=64.176.207.48 bash scripts/deploy-browser-proxy-node.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-64.176.207.48}"
SSH_TARGET="${SSH_TARGET:-root@${VPS_HOST}}"
REMOTE_SRC="${REMOTE_SRC:-/opt/proxo-vpn/src}"
HTTP_PROXY_PORT="${HTTP_PROXY_PORT:-8080}"

echo "Syncing $ROOT → $SSH_TARGET:$REMOTE_SRC"
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude '.env' \
  --exclude 'node-agent/node_modules' \
  --exclude 'node-agent/dist' \
  "$ROOT/" "$SSH_TARGET:$REMOTE_SRC/"

ssh -o BatchMode=yes "$SSH_TARGET" "REMOTE_SRC='$REMOTE_SRC' HTTP_PROXY_PORT='$HTTP_PROXY_PORT' bash -s" <<'REMOTE'
set -euo pipefail
ENV=/opt/proxo-vpn/node-agent/.env
mkdir -p /opt/proxo-vpn/node-agent
if [[ -f "$ENV" ]]; then
  grep -q '^PROXY_ENABLED=' "$ENV" || echo 'PROXY_ENABLED=true' >> "$ENV"
  grep -q '^HTTP_PROXY_PORT=' "$ENV" || echo "HTTP_PROXY_PORT=${HTTP_PROXY_PORT}" >> "$ENV"
  grep -q '^SOCKS_PORT=' "$ENV" || echo 'SOCKS_PORT=1080' >> "$ENV"
  sed -i 's/^PROXY_ENABLED=.*/PROXY_ENABLED=true/' "$ENV"
  sed -i "s/^HTTP_PROXY_PORT=.*/HTTP_PROXY_PORT=${HTTP_PROXY_PORT}/" "$ENV"
fi
ufw allow "${HTTP_PROXY_PORT}/tcp" comment 'Browser HTTP proxy' || true
cd "$REMOTE_SRC"
REPO_ROOT="$REMOTE_SRC" bash infra/wireguard/deploy-agent.sh
sleep 2
echo "== health =="
curl -fsS http://127.0.0.1:4100/health
echo
echo "== listeners =="
ss -lntp | grep -E "4100|${HTTP_PROXY_PORT}|1080" || true
REMOTE

echo ""
echo "Done. From your Mac verify:"
echo "  curl -s http://${VPS_HOST}:4100/health | python3 -m json.tool"
echo "  # expect proxy.httpPort = ${HTTP_PROXY_PORT}"
