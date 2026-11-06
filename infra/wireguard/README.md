# WireGuard node toolkit (Path A)

## Local mock (laptop)

```bash
cd services/node-agent
npm run start:dev   # WG_MOCK=true
```

## Production first node

Overview: [`docs/DEPLOY_NODE_VPS.md`](../../docs/DEPLOY_NODE_VPS.md)  
Step-by-step: **[CHECKLIST.md](./CHECKLIST.md)**

Scripts:

| Script | Purpose |
|--------|---------|
| `bootstrap.sh` | Install + start WireGuard |
| `firewall.sh` | UFW rules |
| `deploy-agent.sh` | Install node-agent + systemd |
| `register-server.sh` | Create server in admin API |
| `verify-node.sh` | Local health check |
| `agent.env.example` | Agent env template |
| `horse-vpn-agent.service` | systemd unit |

Learning notes: [`docs/LEARNING_STEP2_VPS_WIREGUARD.md`](../../docs/LEARNING_STEP2_VPS_WIREGUARD.md)
