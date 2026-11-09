#!/usr/bin/env bash
# Quick health checks for a Proxo VPN node (run on the VPS).
set -euo pipefail

WG_INTERFACE="${WG_INTERFACE:-wg0}"
AGENT_PORT="${AGENT_PORT:-4100}"
SECRET="${AGENT_SECRET:-}"

echo "== WireGuard =="
wg show "${WG_INTERFACE}" || { echo "wg show failed"; exit 1; }

echo ""
echo "== IP forward =="
sysctl net.ipv4.ip_forward

echo ""
echo "== Agent health =="
curl -sS "http://127.0.0.1:${AGENT_PORT}/health" || { echo "agent down"; exit 1; }
echo

if [[ -n "${SECRET}" ]]; then
  echo ""
  echo "== Agent stats =="
  curl -sS "http://127.0.0.1:${AGENT_PORT}/stats" -H "x-agent-secret: ${SECRET}"
  echo
fi

echo ""
echo "== Listening (UDP WireGuard / TCP agent) =="
ss -ulnp | grep -E '51820|wireguard' || true
ss -tlnp | grep ":${AGENT_PORT}" || true

echo ""
echo "OK — node looks healthy locally."
