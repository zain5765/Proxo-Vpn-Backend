import { Injectable } from '@nestjs/common';
import { ServersService } from '../servers/servers.service';

@Injectable()
export class StatusService {
  constructor(private readonly servers: ServersService) {}

  async publicStatus() {
    const started = Date.now();
    const health = await this.servers.refreshHealth();
    const online = health.servers.filter((s) => s.status === 'online').length;
    const degraded = health.servers.filter((s) => s.status === 'degraded').length;
    const unreachable = health.servers.filter((s) => !s.reachable).length;

    let overall: 'operational' | 'degraded' | 'outage' = 'operational';
    if (online === 0) {
      overall = 'outage';
    } else if (degraded > 0 || unreachable > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      checkedAt: new Date().toISOString(),
      checkDurationMs: Date.now() - started,
      summary: {
        online,
        degraded,
        unreachable,
        peers: health.peersTotal,
      },
      regions: health.servers.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.reachable ? s.status : 'unreachable',
        loadPercent: s.loadPercent,
        peers: s.peers,
      })),
      noLogs: true,
      attestationUrl: '/privacy#no-logs',
    };
  }
}
