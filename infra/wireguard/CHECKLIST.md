# First-node checklist (Path A)

Do these in order. Tick each box.

## 0. Buy a VPS

- [ ] Provider: Hetzner / DigitalOcean / Linode / etc.
- [ ] OS: **Ubuntu 22.04 or 24.04**
- [ ] Size: 1 vCPU / 1 GB RAM is enough for first tests
- [ ] Note the **public IPv4**
- [ ] You can SSH in as root (or sudo user)

## 1. Point API secrets (Heroku or local)

**Heroku (preferred once API is online):**

```bash
heroku config:set \
  NODE_AGENT_SECRET=pick-a-long-random-string \
  DEFAULT_AGENT_URL=http://YOUR_VPS_IP:4100 \
  ALLOW_CONNECT_WITHOUT_AGENT=false \
  -a YOUR_HEROKU_APP
```

See `docs/DEPLOY_API_HEROKU.md` and `docs/DEPLOY_NODE_VPS.md`.

**Local API** — in `backend/.env`:

```env
USE_MEMORY_MONGO=false
MONGODB_URI=mongodb://...your atlas or docker...
NODE_AGENT_SECRET=pick-a-long-random-string
ALLOW_CONNECT_WITHOUT_AGENT=false
DEFAULT_AGENT_URL=http://YOUR_VPS_IP:4100
```

- [ ] `NODE_AGENT_SECRET` chosen and saved (same value on VPS agent)
- [ ] API restarted / Heroku config set

## 2. Copy repo to VPS

From your Mac:

```bash
rsync -avz --exclude node_modules --exclude .git \
  "/Users/macbookpro/coding/horse vpn/" \
  root@YOUR_VPS_IP:/opt/proxo-vpn/src/
```

- [ ] Files present on VPS under `/opt/proxo-vpn/src`

## 3. Bootstrap WireGuard

```bash
ssh root@YOUR_VPS_IP
cd /opt/proxo-vpn/src/infra/wireguard
bash bootstrap.sh
```

- [ ] Script printed **Public key**
- [ ] Script printed **Public IP**
- [ ] Saved both somewhere safe

## 4. Firewall

```bash
# Replace with YOUR API server's public IP
sudo API_CIDR=YOUR_API_IP/32 bash firewall.sh
```

If API runs on the same laptop with dynamic IP for early testing, temporarily:

```bash
# DEV ONLY — opens agent to world (tighten later)
sudo API_CIDR=0.0.0.0/0 bash firewall.sh
```

- [ ] UDP 51820 open
- [ ] Agent 4100 restricted (or temporarily open for first test)

## 5. Deploy node-agent

```bash
cd /opt/proxo-vpn/src
sudo REPO_ROOT=/opt/proxo-vpn/src bash infra/wireguard/deploy-agent.sh
sudo nano /opt/proxo-vpn/node-agent/.env
# set AGENT_SECRET=same-as-API-NODE_AGENT_SECRET
# set WG_MOCK=false
sudo systemctl restart proxo-vpn-agent
bash infra/wireguard/verify-node.sh
```

- [ ] `curl http://127.0.0.1:4100/health` → `"mock":false`
- [ ] `systemctl is-active proxo-vpn-agent` → `active`

## 6. Register server in API

On your laptop:

```bash
cd "/Users/macbookpro/coding/horse vpn"
# Local API:
#   API_URL=http://127.0.0.1:4000/v1 ADMIN_KEY=horse-admin-dev \
# Heroku:
#   API_URL=https://YOUR_APP.herokuapp.com/v1 \
#   ADMIN_KEY="$(heroku config:get ADMIN_API_KEY -a YOUR_APP)" \
API_URL=https://YOUR_APP.herokuapp.com/v1 \
ADMIN_KEY=your-admin-key \
ENDPOINT_HOST=YOUR_VPS_IP \
PUBLIC_KEY='paste-from-bootstrap' \
AGENT_BASE_URL=http://YOUR_VPS_IP:4100 \
NAME='First Node' CITY=Amsterdam COUNTRY=NL REGION=eu-test \
bash infra/wireguard/register-server.sh
```

- [ ] Admin/API returns a server JSON with `id`
- [ ] `GET /v1/servers` shows the new node (or free list if not premiumOnly)

## 7. Smoke test connect (API → agent)

```bash
# guest + connect using that serverId and a fake 44-char public key
# Then on VPS: sudo wg show
# You should see a peer appear
```

- [ ] Peer appears in `wg show`
- [ ] Disconnect removes peer (or leaves until revoke)

## 8. Real phone test (comes in Path B)

- [ ] RN CLI Android build
- [ ] Connect → public IP becomes VPS IP ([ifconfig.me](https://ifconfig.me))

## Stop conditions (fix)

| Symptom | Likely cause |
|---------|----------------|
| Agent health mock:true | `.env` still `WG_MOCK=true` |
| 401 from agent | Secret mismatch API vs agent |
| Peer added but no internet | NAT/iptables / wrong default NIC |
| Can't reach agent from API | Firewall / wrong `API_CIDR` |
| Handshake timeout | UDP 51820 blocked by cloud security group |
