import { createServer, Socket, type Server } from 'net';
import { randomBytes } from 'crypto';

export type ProxyUser = {
  username: string;
  password: string;
  expiresAt: number | null;
  createdAt: string;
};

/**
 * HTTP CONNECT proxy with Basic auth — works with Chrome chrome.proxy +
 * webRequest.onAuthRequired (SOCKS5 user/pass does not).
 */
export class HttpProxyManager {
  private readonly users = new Map<string, ProxyUser>();
  private server: Server | null = null;
  private readonly port: number;

  constructor(port: number) {
    this.port = port;
  }

  list(): Array<Omit<ProxyUser, 'password'> & { password: '***' }> {
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
  ): ProxyUser {
    const record: ProxyUser = {
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
      this.server = createServer((socket) => {
        this.handleClient(socket).catch(() => socket.destroy());
      });
      this.server.once('error', reject);
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`HTTP proxy listening on 0.0.0.0:${this.port}`);
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

  private async handleClient(socket: Socket) {
    socket.once('error', () => socket.destroy());
    const head = await readUntil(socket, Buffer.from('\r\n\r\n'));
    const text = head.toString('utf8');
    const lines = text.split('\r\n');
    const requestLine = lines[0] || '';
    const headers: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        headers[line.slice(0, idx).trim().toLowerCase()] = line
          .slice(idx + 1)
          .trim();
      }
    }

    const auth = headers['proxy-authorization'] || '';
    const ok = this.checkBasicAuth(auth);
    if (!ok) {
      socket.write(
        'HTTP/1.1 407 Proxy Authentication Required\r\n' +
          'Proxy-Authenticate: Basic realm="WayLinkVpn"\r\n' +
          'Connection: close\r\n\r\n',
      );
      socket.destroy();
      return;
    }

    const [method, target] = requestLine.split(' ');
    if (method === 'CONNECT') {
      const [host, portStr] = (target || '').split(':');
      const port = Number(portStr || 443);
      if (!host || !port) {
        socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      const remote = new Socket();
      remote.once('error', () => {
        socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
        socket.destroy();
      });
      remote.connect(port, host, () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        socket.pipe(remote);
        remote.pipe(socket);
      });
      socket.once('close', () => remote.destroy());
      remote.once('close', () => socket.destroy());
      return;
    }

    socket.write(
      'HTTP/1.1 501 Not Implemented\r\nConnection: close\r\n\r\n',
    );
    socket.destroy();
  }

  private checkBasicAuth(header: string): boolean {
    if (!header.toLowerCase().startsWith('basic ')) return false;
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx < 0) return false;
      return this.authenticate(decoded.slice(0, idx), decoded.slice(idx + 1));
    } catch {
      return false;
    }
  }
}

function readUntil(socket: Socket, marker: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf(marker);
      if (idx >= 0) {
        cleanup();
        const end = idx + marker.length;
        const exact = buf.subarray(0, end);
        const rest = buf.subarray(end);
        if (rest.length) socket.unshift(rest);
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
