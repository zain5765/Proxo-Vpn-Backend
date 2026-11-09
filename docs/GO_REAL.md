# Make Proxo VPN real (first node)

Fake seed servers (`*.proxovpn.local`) cannot change your phone’s public IP.  
You need **one cheap VPS** with WireGuard.

## 1. Create a VPS (≈ $4–6 / month)

Providers: [Hetzner](https://www.hetzner.com/cloud), [DigitalOcean](https://www.digitalocean.com), [Linode](https://www.linode.com)

- OS: **Ubuntu 22.04 or 24.04**
- Size: 1 vCPU / 1 GB RAM is enough
- Open in the cloud firewall: **UDP 51820**, **TCP 22**, **TCP 4100** (agent; tighten later)
- Note the **public IPv4**
- Enable **root SSH** (or a sudo user) with your Mac’s key

## 2. One-command bring-up (from your Mac)

API must be running locally first (`npm run start:dev` in this repo).

```bash
cd "/Users/macbookpro/coding/horse-vpn-backend"

# Use the same secret as NODE_AGENT_SECRET in .env
VPS_HOST=YOUR.VPS.IP.HERE \
AGENT_SECRET='change-me-node-agent-secret' \
ADMIN_KEY='horse-admin-dev' \
  bash scripts/bring-up-first-node.sh
```

That script will:
1. Copy this backend repo to the VPS  
2. Install WireGuard  
3. Deploy `node-agent` with `WG_MOCK=false`  
4. Register the server in your API  

## 3. Point local API at the VPS

In `.env`:

```env
DEFAULT_AGENT_URL=http://YOUR.VPS.IP.HERE:4100
NODE_AGENT_SECRET=change-me-node-agent-secret
ALLOW_CONNECT_WITHOUT_AGENT=false
```

Restart the API.

## 4. Phone

Rebuild/reinstall the app (or keep current build if API URL is still `127.0.0.1:4000` + `adb reverse`).

1. Open Proxo VPN → pick the new server (not Germany Frankfurt seed if you prefer)  
2. Connect → allow Android VPN permission  
3. Visit https://ifconfig.me — IP should equal **YOUR.VPS.IP**

## Verify on VPS

```bash
ssh root@YOUR.VPS.IP
sudo wg show
curl -s http://127.0.0.1:4100/health
```

While the phone is connected, `wg show` should list a peer.
