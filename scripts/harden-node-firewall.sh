#!/usr/bin/env bash
# Tighten node-agent TCP 4100 to the API host only (after first successful bring-up).
#
# Usage:
#   VPS_HOST=1.2.3.4 API_CIDR=5.6.7.8/32 bash scripts/harden-node-firewall.sh
#
# API_CIDR should be the public IP of the machine running Nest (or Heroku egress).
# If you develop locally, use your current public IP: curl -4 -s ifconfig.me
set -euo pipefail

VPS_HOST="${VPS_HOST:?Set VPS_HOST to the node public IPv4}"
API_CIDR="${API_CIDR:?Set API_CIDR e.g. 203.0.113.10/32}"
SSH_USER="${SSH_USER:-root}"
REMOTE_SRC="${REMOTE_SRC:-/opt/proxo-vpn/src}"

ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${VPS_HOST}" \
  "API_CIDR='${API_CIDR}' bash '${REMOTE_SRC}/infra/wireguard/firewall.sh'"

echo "Hardened: agent :4100 only from ${API_CIDR}; WireGuard UDP still world-open."
