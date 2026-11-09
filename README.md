# Proxo VPN — Backend

Complete server-side stack:

| Piece | Path | Deploy |
|-------|------|--------|
| NestJS control-plane API | `src/` (this repo root) | **Heroku** |
| WireGuard node-agent | `node-agent/` | **VPS** (not Heroku) |
| VPS scripts | `infra/wireguard/` | run on the VPS |

Sibling repos:

- Clients (mobile + web): `../horse vpn`
- VPN admin UI: `../proxo-vpn-admin`

## API (local)

```bash
cp .env.example .env
npm install
npm run start:dev
```

Health: `http://localhost:4000/v1/health`

## API → Heroku

```bash
heroku login
heroku create proxo-vpn-api-YOURNAME
heroku config:set USE_MEMORY_MONGO=false \
  MONGODB_URI='mongodb+srv://...' \
  JWT_SECRET="$(openssl rand -hex 32)" \
  NODE_AGENT_SECRET="$(openssl rand -hex 24)" \
  CORS_ORIGINS='*' \
  ALLOW_CONNECT_WITHOUT_AGENT=true
git push heroku main
```

## Node-agent → VPS

Follow `infra/wireguard/CHECKLIST.md`. Do not run the agent on Heroku.
