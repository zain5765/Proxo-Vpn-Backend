import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ProvisionedPeer = {
  publicKey: string;
  address: string;
  createdAt: string;
};

@Injectable()
export class NodeAgentClient {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>(
      'NODE_AGENT_SECRET',
      'change-me-node-agent-secret',
    );
  }

  async provisionPeer(
    agentBaseUrl: string,
    publicKey: string,
  ): Promise<ProvisionedPeer> {
    const url = `${agentBaseUrl.replace(/\/$/, '')}/peers`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-secret': this.secret(),
        },
        body: JSON.stringify({ publicKey }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new ServiceUnavailableException(
          `Node agent provision failed (${res.status}): ${body}`,
        );
      }

      return (await res.json()) as ProvisionedPeer;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Node agent unreachable at ${agentBaseUrl}`,
      );
    }
  }

  async revokePeer(agentBaseUrl: string, publicKey: string): Promise<void> {
    const url = `${agentBaseUrl.replace(/\/$/, '')}/peers/${encodeURIComponent(publicKey)}`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'x-agent-secret': this.secret(),
        },
      });
      if (!res.ok && res.status !== 404) {
        const body = await res.text();
        throw new ServiceUnavailableException(
          `Node agent revoke failed (${res.status}): ${body}`,
        );
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Node agent unreachable at ${agentBaseUrl}`,
      );
    }
  }

  async fetchStats(
    agentBaseUrl: string,
  ): Promise<{ peers: number; loadPercent: number } | null> {
    try {
      const res = await fetch(`${agentBaseUrl.replace(/\/$/, '')}/stats`, {
        headers: { 'x-agent-secret': this.secret() },
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as { peers: number; loadPercent: number };
    } catch {
      return null;
    }
  }
}
