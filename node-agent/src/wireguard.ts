import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type PeerRecord = {
  publicKey: string;
  address: string;
  createdAt: string;
};

export class WireGuardManager {
  private readonly peers = new Map<string, PeerRecord>();
  private nextOctet = 2;

  constructor(
    private readonly iface: string,
    private readonly subnetPrefix: string,
    private readonly mock: boolean,
  ) {}

  list(): PeerRecord[] {
    return [...this.peers.values()];
  }

  peerCount(): number {
    return this.peers.size;
  }

  async addPeer(publicKey: string): Promise<PeerRecord> {
    const existing = this.peers.get(publicKey);
    if (existing) {
      return existing;
    }

    const octet = this.allocateOctet();
    const address = `${this.subnetPrefix}.${octet}/32`;
    const record: PeerRecord = {
      publicKey,
      address,
      createdAt: new Date().toISOString(),
    };

    if (!this.mock) {
      // PersistentKeepalive keeps NAT mappings alive on mobile networks.
      await execFileAsync('wg', [
        'set',
        this.iface,
        'peer',
        publicKey,
        'allowed-ips',
        address,
        'persistent-keepalive',
        '25',
      ]);
    }

    this.peers.set(publicKey, record);
    return record;
  }

  async removePeer(publicKey: string): Promise<boolean> {
    const existing = this.peers.get(publicKey);
    if (!existing) {
      return false;
    }

    if (!this.mock) {
      await execFileAsync('wg', ['set', this.iface, 'peer', publicKey, 'remove']);
    }

    this.peers.delete(publicKey);
    return true;
  }

  private allocateOctet(): number {
    while (this.nextOctet < 254) {
      const candidate = this.nextOctet++;
      const taken = [...this.peers.values()].some((p) =>
        p.address.startsWith(`${this.subnetPrefix}.${candidate}/`),
      );
      if (!taken) {
        return candidate;
      }
    }
    throw new Error('Address pool exhausted');
  }
}
