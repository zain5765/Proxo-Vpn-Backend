#!/usr/bin/env bash
# Mark fake *.proxovpn.local seed servers inactive (keeps DB rows for reference).
#
# Usage:
#   API_URL=http://127.0.0.1:4000/v1 ADMIN_KEY=horse-admin-dev \
#     bash scripts/deactivate-seed-servers.sh
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000/v1}"
ADMIN_KEY="${ADMIN_KEY:-horse-admin-dev}"

echo "==> Listing admin servers at ${API_URL}/admin/servers"
ROWS="$(curl -fsS -H "x-admin-key: ${ADMIN_KEY}" "${API_URL}/admin/servers")"

API_URL="${API_URL}" ADMIN_KEY="${ADMIN_KEY}" ROWS="${ROWS}" python3 - <<'PY'
import json, os, urllib.request

api = os.environ["API_URL"].rstrip("/")
key = os.environ["ADMIN_KEY"]
rows = json.loads(os.environ["ROWS"])
seeds = [r for r in rows if str(r.get("endpointHost", "")).endswith(".proxovpn.local")]
print(f"Found {len(seeds)} seed server(s)")
for s in seeds:
    sid = s["id"]
    body = json.dumps({"active": False}).encode()
    req = urllib.request.Request(
        f"{api}/admin/servers/{sid}",
        data=body,
        headers={"Content-Type": "application/json", "x-admin-key": key},
        method="PATCH",
    )
    with urllib.request.urlopen(req) as resp:
        print(f"  deactivated {s.get('name')} ({sid}) -> HTTP {resp.status}")
if not seeds:
    print("Nothing to deactivate.")
PY
