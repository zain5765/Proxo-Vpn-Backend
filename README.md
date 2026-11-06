# Horse VPN — Backend API

Standalone NestJS control-plane for Horse VPN. Deploy this repo to **Heroku**.

The full product (mobile, web, agent) lives in the sibling monorepo: `../horse vpn`.

## Local

```bash
cp .env.example .env
npm install
npm run start:dev
```

Health: `http://localhost:4000/v1/health`

## Deploy to Heroku

```bash
heroku login
heroku create horse-vpn-api-YOURNAME

heroku config:set USE_MEMORY_MONGO=false \
  MONGODB_URI='mongodb+srv://USER:PASS@CLUSTER.mongodb.net/horse-vpn?retryWrites=true&w=majority' \
  JWT_SECRET="$(openssl rand -hex 32)" \
  NODE_AGENT_SECRET="$(openssl rand -hex 24)" \
  CORS_ORIGINS='*' \
  ALLOW_CONNECT_WITHOUT_AGENT=true

git push heroku main
curl -s https://horse-vpn-api-YOURNAME.herokuapp.com/v1/health
```

Env templates: `.env.example`, `.env.production.example`

## Sync from monorepo

If you edit `backend/` inside the monorepo, copy changes here before deploying:

```bash
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .env --exclude .git \
  "../horse vpn/backend/" ./
```
