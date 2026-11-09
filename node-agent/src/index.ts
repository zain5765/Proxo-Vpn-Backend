import { config as loadEnv } from 'dotenv';
import express from 'express';
import { z } from 'zod';
import { WireGuardManager } from './wireguard';

loadEnv();

const PORT = Number(process.env.PORT ?? 4100);
const AGENT_SECRET = process.env.AGENT_SECRET ?? 'change-me-node-agent-secret';
const WG_INTERFACE = process.env.WG_INTERFACE ?? 'wg0';
const WG_SUBNET_PREFIX = process.env.WG_SUBNET_PREFIX ?? '10.8.0';
const WG_MOCK = (process.env.WG_MOCK ?? 'true') === 'true';

const app = express();
app.use(express.json());

const wg = new WireGuardManager(WG_INTERFACE, WG_SUBNET_PREFIX, WG_MOCK);

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

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'proxo-vpn-node-agent',
    mock: WG_MOCK,
    iface: WG_INTERFACE,
    peers: wg.peerCount(),
  });
});

app.get('/stats', requireAgentAuth, (_req, res) => {
  const peers = wg.peerCount();
  const loadPercent = Math.min(100, Math.round((peers / 250) * 100));
  res.json({
    peers,
    loadPercent,
    mock: WG_MOCK,
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

app.listen(PORT, () => {
  console.log(
    `Proxo VPN node-agent on :${PORT} (mock=${WG_MOCK}, iface=${WG_INTERFACE})`,
  );
});
