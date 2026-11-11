import { createServer, Socket, type Server } from 'net';
import { randomBytes } from 'crypto';

export type SocksUser = {
  username: string;
  password: string;
  expiresAt: number | null;
  createdAt: string;
};

/**
 * Minimal SOCKS5 server with username/password auth (RFC 1928 + 1929).
 * Used by the browser extension via chrome.proxy — not a WireGuard tunnel.
 */
export class SocksProxyManager {
  private readonly users = new Map<string, SocksUser>();
  private server: Server | null = null;
  private readonly port: number;

  constructor(port: number) {
    this.port = port;
  }

  list(): Array<Omit<SocksUser, 'password'> & { password: '***' }> {
    this.pruneExpired();
    return [...this.users.values()].map(({ password: _p, ...rest }) => ({
      ...rest,
      password: '***' as const,
    }));
  }

  userCount(): number {
    this.pruneExpired();
    return this.users.size;
  }

  addUser(
    username: string,
    password: string,
    ttlSeconds?: number | null,
  ): SocksUser {
    const record: SocksUser = {
      username,
      password,
      expiresAt:
        ttlSeconds && ttlSeconds > 0
          ? Date.now() + ttlSeconds * 1000
          : null,
      createdAt: new Date().toISOString(),
    };
    this.users.set(username, record);
    return record;
  }

  removeUser(username: string): boolean {
    return this.users.delete(username);
  }

  static randomPassword(bytes = 18): string {
    return randomBytes(bytes).toString('base64url');
  }

  start(): Promise<void> {
    if (this.server) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.handleClient(socket));
      this.server.once('error', reject);
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`SOCKS5 proxy listening on 0.0.0.0:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private pruneExpired() {
    const now = Date.now();
    for (const [user, record] of this.users) {
      if (record.expiresAt != null && record.expiresAt <= now) {
        this.users.delete(user);
      }
    }
  }

  private authenticate(username: string, password: string): boolean {
    this.pruneExpired();
    const record = this.users.get(username);
    if (!record) return false;
    if (record.expiresAt != null && record.expiresAt <= Date.now()) {
      this.users.delete(username);
      return false;
    }
    return record.password === password;
  }

  private handleClient(socket: Socket) {
    socket.once('error', () => socket.destroy());
    this.readGreeting(socket).catch(() => socket.destroy());
  }

  private async readGreeting(socket: Socket) {
    const header = await readExact(socket, 2);
    const ver = header[0];
    const nMethods = header[1];
    if (ver !== 0x05) {
      socket.destroy();
      return;
    }
    const methods = await readExact(socket, nMethods);
    // Require username/password (0x02)
    if (![...methods].includes(0x02)) {
      socket.write(Buffer.from([0x05, 0xff]));
      socket.destroy();
      return;
    }
    socket.write(Buffer.from([0x05, 0x02]));

    const authHeader = await readExact(socket, 2);
    if (authHeader[0] !== 0x01) {
      socket.destroy();
      return;
    }
    const ulen = authHeader[1];
    const usernameBuf = await readExact(socket, ulen);
    const plenBuf = await readExact(socket, 1);
    const plen = plenBuf[0];
    const passwordBuf = await readExact(socket, plen);
    const username = usernameBuf.toString('utf8');
    const password = passwordBuf.toString('utf8');

    if (!this.authenticate(username, password)) {
      socket.write(Buffer.from([0x01, 0x01]));
      socket.destroy();
      return;
    }
    socket.write(Buffer.from([0x01, 0x00]));

    await this.handleRequest(socket);
  }

  private async handleRequest(socket: Socket) {
    const req = await readExact(socket, 4);
    const ver = req[0];
    const cmd = req[1];
    const atyp = req[3];
    if (ver !== 0x05) {
      socket.destroy();
      return;
    }

    let host = '';
    if (atyp === 0x01) {
      const addr = await readExact(socket, 4);
      host = [...addr].join('.');
    } else if (atyp === 0x03) {
      const lenBuf = await readExact(socket, 1);
      const name = await readExact(socket, lenBuf[0]);
      host = name.toString('utf8');
    } else if (atyp === 0x04) {
      // IPv6 — reply address type not supported for simplicity
      socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      socket.destroy();
      return;
    } else {
      socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      socket.destroy();
      return;
    }

    const portBuf = await readExact(socket, 2);
    const port = (portBuf[0] << 8) | portBuf[1];

    // Only CONNECT
    if (cmd !== 0x01) {
      socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      socket.destroy();
      return;
    }

    const remote = new Socket();
    remote.once('error', () => {
      try {
        socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      } catch {
        // ignore
      }
      socket.destroy();
    });

    remote.connect(port, host, () => {
      const reply = Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
      socket.write(reply);
      socket.pipe(remote);
      remote.pipe(socket);
    });

    socket.once('close', () => remote.destroy());
    remote.once('close', () => socket.destroy());
  }
}

function readExact(socket: Socket, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let got = 0;

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      got += chunk.length;
      if (got >= length) {
        cleanup();
        const buf = Buffer.concat(chunks);
        const exact = buf.subarray(0, length);
        const rest = buf.subarray(length);
        if (rest.length) {
          socket.unshift(rest);
        }
        resolve(exact);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('socket closed'));
    };

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}
