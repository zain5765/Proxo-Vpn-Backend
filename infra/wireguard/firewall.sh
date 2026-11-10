#!/usr/bin/env bash
# Harden a Proxo VPN node with UFW.
# Usage:
#   sudo API_CIDR=1.2.3.4/32 bash firewall.sh
# API_CIDR = IP (or range) of your NestJS control plane that may call the agent.
set -euo pipefail

WG_PORT="${WG_PORT:-51820}"
AGENT_PORT="${AGENT_PORT:-4100}"
SSH_PORT="${SSH_PORT:-22}"
API_CIDR="${API_CIDR:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

if [[ -z "${API_CIDR}" ]]; then
  echo "WARNING: API_CIDR not set. Agent port ${AGENT_PORT} will stay closed until you allow your API IP."
  echo "Example: sudo API_CIDR=203.0.113.10/32 bash firewall.sh"
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing

ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow "${WG_PORT}/udp" comment 'WireGuard'

if [[ -n "${API_CIDR}" ]]; then
  ufw allow from "${API_CIDR}" to any port "${AGENT_PORT}" proto tcp comment 'Proxo node-agent from API'
fi

ufw --force enable
ufw status verbose

echo ""
echo "Firewall ready."
echo "  World  -> UDP ${WG_PORT} (WireGuard)"
echo "  API    -> TCP ${AGENT_PORT} (only if API_CIDR set)"
echo "  You    -> TCP ${SSH_PORT} (SSH)"
