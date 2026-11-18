#!/usr/bin/env bash
# Push current main to Heroku so /v1/browser/connect is live.
# Requires: heroku login (interactive once).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${HEROKU_APP:-vpn-proxo-9731704aa261}"
cd "$ROOT"

if ! heroku auth:whoami >/dev/null 2>&1; then
  echo "Heroku CLI not logged in. Run: heroku login"
  exit 1
fi

heroku git:remote -a "$APP" >/dev/null
echo "Pushing $(git rev-parse --short HEAD) → heroku ($APP)…"
git push heroku HEAD:main

echo ""
echo "Waiting for dyno…"
sleep 8
curl -fsS "https://${APP}.herokuapp.com/v1/health" | python3 -m json.tool

CODE=$(curl -sS -o /tmp/wl_browser_probe.json -w "%{http_code}" \
  -X POST "https://${APP}.herokuapp.com/v1/browser/connect" \
  -H 'Content-Type: application/json' \
  -d '{}')
echo "POST /v1/browser/connect → HTTP $CODE (expect 401, not 404)"
cat /tmp/wl_browser_probe.json; echo
if [[ "$CODE" == "404" ]]; then
  echo "FAIL: browser routes still missing on Heroku"
  exit 1
fi
echo "API browser routes are live."
echo "Next: bash ../WaylinkVpn-app/scripts/smoke-browser-connect.sh"
