import { config as loadEnv } from 'dotenv';
import express from 'express';
import { z } from 'zod';
import { HttpProxyManager } from './http-proxy';
import { SocksProxyManager } from './socks';
import { WireGuardManager } from './wireguard';

loadEnv();

const PORT = Number(process.env.PORT ?? 4100);
const SOCKS_PORT = Number(process.env.SOCKS_PORT ?? 1080);
const HTTP_PROXY_PORT = Number(process.env.HTTP_PROXY_PORT ?? 8080);
const AGENT_SECRET = process.env.AGENT_SECRET ?? 'change-me-node-agent-secret';
const WG_INTERFACE = process.env.WG_INTERFACE ?? 'wg0';
const WG_SUBNET_PREFIX = process.env.WG_SUBNET_PREFIX ?? '10.8.0';
const WG_MOCK = (process.env.WG_MOCK ?? 'true') === 'true';
const PROXY_ENABLED = (process.env.PROXY_ENABLED ?? process.env.SOCKS_ENABLED ?? 'true') === 'true';

const app = express();
app.use(express.json());

const wg = new WireGuardManager(WG_INTERFACE, WG_SUBNET_PREFIX, WG_MOCK);
/** Chrome extension uses HTTP CONNECT + Basic auth. */
const httpProxy = new HttpProxyManager(HTTP_PROXY_PORT);
/** Optional SOCKS5 for non-Chrome clients. */
const socks = new SocksProxyManager(SOCKS_PORT);

function requireAgentAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.header('x-agent-secret');
  if (!header || header !== AGENT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function addProxyUser(
  username: string,
  password: string,
  ttlSeconds?: number | null,
) {
  httpProxy.addUser(username, password, ttlSeconds);
  socks.addUser(username, password, ttlSeconds);
}

function removeProxyUser(username: string) {
  const a = httpProxy.removeUser(username);
  const b = socks.removeUser(username);
  return a || b;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'proxo-vpn-node-agent',
    mock: WG_MOCK,
    iface: WG_INTERFACE,
    peers: wg.peerCount(),
    proxy: {
      enabled: PROXY_ENABLED,
      httpPort: HTTP_PROXY_PORT,
      socksPort: SOCKS_PORT,
      users: httpProxy.userCount(),
    },
  });
});

app.get('/stats', requireAgentAuth, (_req, res) => {
  const peers = wg.peerCount();
  const loadPercent = Math.min(100, Math.round((peers / 250) * 100));
  res.json({
    peers,
    loadPercent,
    mock: WG_MOCK,
    proxyUsers: httpProxy.userCount(),
  });
});

const addPeerSchema = z.object({
  publicKey: z.string().min(32),
});

app.post('/peers', requireAgentAuth, async (req, res) => {
  const parsed = addPeerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const peer = await wg.addPeer(parsed.data.publicKey);
    return res.status(201).json(peer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add peer';
    return res.status(500).json({ error: message });
  }
});

app.delete('/peers/:publicKey', requireAgentAuth, async (req, res) => {
  try {
    const publicKey = String(req.params.publicKey ?? '');
    const removed = await wg.removePeer(publicKey);
    if (!removed) {
      return res.status(404).json({ error: 'Peer not found' });
    }
    return res.status(204).send();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to remove peer';
    return res.status(500).json({ error: message });
  }
});

app.get('/peers', requireAgentAuth, (_req, res) => {
  res.json({ peers: wg.list() });
});

const addProxySchema = z.object({
  username: z.string().min(4).max(64),
  password: z.string().min(8).max(128),
  ttlSeconds: z.number().int().positive().nullable().optional(),
});

function provisionProxy(req: express.Request, res: express.Response) {
  if (!PROXY_ENABLED) {
    return res.status(503).json({ error: 'Proxy disabled on this node' });
  }
  const parsed = addProxySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  addProxyUser(
    parsed.data.username,
    parsed.data.password,
    parsed.data.ttlSeconds ?? null,
  );
  const record = httpProxy
    .list()
    .find((u) => u.username === parsed.data.username);
  return res.status(201).json({
    username: parsed.data.username,
    createdAt: record?.createdAt ?? new Date().toISOString(),
    expiresAt: record?.expiresAt ?? null,
    proxyPort: HTTP_PROXY_PORT,
    proxyScheme: 'http',
    socksPort: SOCKS_PORT,
  });
}

app.post('/proxy/users', requireAgentAuth, provisionProxy);
/** Alias used by API client (historical name). */
app.post('/socks/users', requireAgentAuth, provisionProxy);

app.delete('/proxy/users/:username', requireAgentAuth, (req, res) => {
  const username = String(req.params.username ?? '');
  const removed = removeProxyUser(username);
  if (!removed) {
    return res.status(404).json({ error: 'Proxy user not found' });
  }
  return res.status(204).send();
});

app.delete('/socks/users/:username', requireAgentAuth, (req, res) => {
  const username = String(req.params.username ?? '');
  const removed = removeProxyUser(username);
  if (!removed) {
    return res.status(404).json({ error: 'SOCKS user not found' });
  }
  return res.status(204).send();
});

app.get('/proxy/users', requireAgentAuth, (_req, res) => {
  res.json({
    users: httpProxy.list(),
    httpPort: HTTP_PROXY_PORT,
    socksPort: SOCKS_PORT,
  });
});

app.get('/socks/users', requireAgentAuth, (_req, res) => {
  res.json({ users: socks.list(), port: SOCKS_PORT });
});

async function boot() {
  if (PROXY_ENABLED) {
    await httpProxy.start();
    await socks.start();
  }
  app.listen(PORT, () => {
    console.log(
      `Proxo VPN node-agent on :${PORT} (mock=${WG_MOCK}, iface=${WG_INTERFACE}, httpProxy=${PROXY_ENABLED ? HTTP_PROXY_PORT : 'off'}, socks=${PROXY_ENABLED ? SOCKS_PORT : 'off'})`,
    );
  });
}

boot().catch((err) => {
  console.error(err);
  process.exit(1);
});
