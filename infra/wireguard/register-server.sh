#!/usr/bin/env bash
# Register this VPS as a server in the Horse VPN admin API.
# Run on your laptop (with API reachable), not necessarily on the VPS.
#
# Example:
#   API_URL=http://127.0.0.1:4000/v1 \
#   ADMIN_KEY=horse-admin-dev \
#   ENDPOINT_HOST=203.0.113.50 \
#   PUBLIC_KEY='xxxx=' \
#   AGENT_BASE_URL=http://203.0.113.50:4100 \
#   NAME='US East 1' CITY=New\ York COUNTRY=US REGION=us-east \
#   bash infra/wireguard/register-server.sh
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000/v1}"
ADMIN_KEY="${ADMIN_KEY:-horse-admin-dev}"
NAME="${NAME:-New Node}"
CITY="${CITY:-Unknown}"
COUNTRY="${COUNTRY:-XX}"
REGION="${REGION:-custom}"
ENDPOINT_HOST="${ENDPOINT_HOST:?Set ENDPOINT_HOST to VPS public IP or DNS}"
ENDPOINT_PORT="${ENDPOINT_PORT:-51820}"
PUBLIC_KEY="${PUBLIC_KEY:?Set PUBLIC_KEY from bootstrap output}"
AGENT_BASE_URL="${AGENT_BASE_URL:?Set AGENT_BASE_URL e.g. http://IP:4100}"
PREMIUM_ONLY="${PREMIUM_ONLY:-false}"

BODY=$(cat <<EOF
{
  "name": "${NAME}",
  "countryCode": "${COUNTRY}",
  "city": "${CITY}",
  "region": "${REGION}",
  "endpointHost": "${ENDPOINT_HOST}",
  "endpointPort": ${ENDPOINT_PORT},
  "publicKey": "${PUBLIC_KEY}",
  "agentBaseUrl": "${AGENT_BASE_URL}",
  "premiumOnly": ${PREMIUM_ONLY},
  "tags": [],
  "status": "online",
  "active": true,
  "loadPercent": 0
}
EOF
)

echo "POST ${API_URL}/admin/servers"
curl -sS -X POST "${API_URL}/admin/servers" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -d "${BODY}"
echo
