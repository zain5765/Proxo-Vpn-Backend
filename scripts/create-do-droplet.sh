#!/usr/bin/env bash
# Create a minimal Ubuntu droplet for the first Proxo WireGuard node (DigitalOcean).
#
# Prerequisites:
#   brew install doctl
#   export DIGITALOCEAN_ACCESS_TOKEN=dop_v1_...
#   doctl auth init  # or rely on the env token
#
# Usage:
#   bash scripts/create-do-droplet.sh
#   # prints VPS_HOST=<ip>
set -euo pipefail

NAME="${NAME:-proxo-vpn-node-1}"
REGION="${REGION:-nyc3}"
SIZE="${SIZE:-s-1vcpu-1gb}"
IMAGE="${IMAGE:-ubuntu-24-04-x64}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519.pub}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENTS_DOCTL="/Users/macbookpro/coding/Proxo-vpn/.tools/doctl"
if command -v doctl >/dev/null 2>&1; then
  DOCTL="$(command -v doctl)"
elif [[ -x "${CLIENTS_DOCTL}" ]]; then
  DOCTL="${CLIENTS_DOCTL}"
elif [[ -x "${ROOT}/.tools/doctl" ]]; then
  DOCTL="${ROOT}/.tools/doctl"
else
  echo "doctl not found. Install with: brew install doctl" >&2
  echo "Or place a binary at ${CLIENTS_DOCTL}" >&2
  exit 1
fi
doctl() { "${DOCTL}" "$@"; }

if [[ -z "${DIGITALOCEAN_ACCESS_TOKEN:-}" ]] && ! doctl auth list >/dev/null 2>&1; then
  echo "Set DIGITALOCEAN_ACCESS_TOKEN or run: doctl auth init" >&2
  exit 1
fi

if [[ ! -f "${SSH_KEY_PATH}" ]]; then
  echo "SSH public key not found at ${SSH_KEY_PATH}" >&2
  exit 1
fi

PUB_KEY="$(cat "${SSH_KEY_PATH}")"
KEY_NAME="proxo-mac-$(whoami)"

# Import key if fingerprint not already present
if ! doctl compute ssh-key list --format FingerPrint,Name --no-header | grep -qi proxo-mac; then
  echo "==> Importing SSH key ${KEY_NAME}"
  doctl compute ssh-key create "${KEY_NAME}" --public-key "${PUB_KEY}" >/dev/null
fi

KEY_ID="$(doctl compute ssh-key list --format ID,Name --no-header | awk -v n="${KEY_NAME}" '$2==n {print $1; exit}')"
if [[ -z "${KEY_ID}" ]]; then
  # Fall back to first key on the account
  KEY_ID="$(doctl compute ssh-key list --format ID --no-header | head -1 | tr -d '[:space:]')"
fi
if [[ -z "${KEY_ID}" ]]; then
  echo "No SSH keys available on the DigitalOcean account" >&2
  exit 1
fi

echo "==> Creating droplet ${NAME} (${SIZE}, ${REGION}, ${IMAGE})"
DROPLET_JSON="$(doctl compute droplet create "${NAME}" \
  --region "${REGION}" \
  --size "${SIZE}" \
  --image "${IMAGE}" \
  --ssh-keys "${KEY_ID}" \
  --wait \
  --format ID,Name,PublicIPv4 \
  --no-header)"

IP="$(echo "${DROPLET_JSON}" | awk '{print $NF}' | tr -d '[:space:]')"
if [[ -z "${IP}" || "${IP}" == "<nil>" ]]; then
  echo "Failed to get public IP from: ${DROPLET_JSON}" >&2
  exit 1
fi

# Cloud firewall-ish: tag for docs; UFW is applied by bring-up-first-node.sh
echo "==> Droplet ready"
echo "VPS_HOST=${IP}"
echo ""
echo "Next:"
echo "  cd \"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)\""
echo "  VPS_HOST=${IP} AGENT_SECRET=\"\$NODE_AGENT_SECRET\" ADMIN_KEY=\"\$ADMIN_API_KEY\" \\"
echo "    bash scripts/bring-up-first-node.sh"
