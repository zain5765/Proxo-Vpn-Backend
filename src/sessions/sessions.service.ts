import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomInt } from 'crypto';
import { Model } from 'mongoose';
import { NodeAgentClient } from '../nodes/node-agent.client';
import { ServersService } from '../servers/servers.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { Device, DeviceDocument } from '../users/schemas/device.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { ServerDocument } from '../servers/schemas/server.schema';
import { ConnectDto } from './dto/connect.dto';
import { DisconnectDto } from './dto/disconnect.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly servers: ServersService,
    private readonly nodes: NodeAgentClient,
    private readonly config: ConfigService,
    private readonly telemetry: TelemetryService,
    @InjectModel(Device.name) private readonly devices: Model<DeviceDocument>,
  ) {}

  async requestConnect(user: UserDocument, dto: ConnectDto) {
    const started = Date.now();
    try {
      const result = await this.connectInternal(user, dto);
      await this.telemetry.track({
        type: 'connect_success',
        region: result.server.region,
        durationMs: Date.now() - started,
        premium: user.plan === 'premium',
      });
      if (result.multiHop) {
        await this.telemetry.track({
          type: 'multihop',
          region: result.server.region,
          premium: true,
        });
      }
      if (result.failoverUsed) {
        await this.telemetry.track({
          type: 'failover',
          region: result.server.region,
          premium: user.plan === 'premium',
        });
      }
      return result;
    } catch (error) {
      await this.telemetry.track({
        type: 'connect_fail',
        durationMs: Date.now() - started,
        reason: error instanceof Error ? error.message : 'unknown',
        premium: user.plan === 'premium',
      });
      throw error;
    }
  }

  private async connectInternal(user: UserDocument, dto: ConnectDto) {
    const provisionStarted = Date.now();
    let server = await this.servers.findActiveById(dto.serverId);
    if (!server || server.status === 'offline') {
      throw new NotFoundException('Server unavailable');
    }

    if (server.premiumOnly && user.plan !== 'premium') {
      throw new ForbiddenException('Premium required for this server');
    }

    if (dto.multiHop && user.plan !== 'premium') {
      throw new ForbiddenException('Multi-hop requires Premium');
    }

    if (dto.stealth && user.plan !== 'premium') {
      throw new ForbiddenException('Stealth mode requires Premium');
    }

    await this.enforceDeviceLimit(user, dto.deviceId);

    let failoverUsed = false;
    let provisioned = await this.tryProvision(server, dto.clientPublicKey);

    if (!provisioned.ok && dto.allowFailover !== false) {
      const alternate = await this.pickFailover(server, user.plan === 'premium');
      if (alternate) {
        server = alternate;
        provisioned = await this.tryProvision(server, dto.clientPublicKey);
        failoverUsed = provisioned.ok;
      }
    }

    if (!provisioned.ok || !provisioned.address) {
      throw new ServiceUnavailableException(
        provisioned.error || 'Unable to provision tunnel peer',
      );
    }

    let exit:
      | {
          id: string;
          name: string;
          city: string;
          countryCode: string;
          region: string;
          endpoint: string;
          serverPublicKey: string;
        }
      | undefined;

    if (dto.multiHop) {
      const exitServer = await this.resolveExitServer(dto, server, user);
      const exitProvision = await this.tryProvision(
        exitServer,
        dto.clientPublicKey,
      );
      if (!exitProvision.ok) {
        throw new ServiceUnavailableException(
          'Unable to provision multi-hop exit peer',
        );
      }
      exit = {
        id: exitServer.id as string,
        name: exitServer.name,
        city: exitServer.city,
        countryCode: exitServer.countryCode,
        region: exitServer.region,
        endpoint: this.endpointFor(exitServer, false),
        serverPublicKey: exitServer.publicKey,
      };
    }

    const useStealth =
      !!dto.stealth &&
      this.config.get('FEATURE_STEALTH') === 'true' &&
      !!server.stealthEndpoint;

    return {
      serverPublicKey: server.publicKey,
      endpoint: this.endpointFor(server, useStealth),
      address: provisioned.address,
      dns: ['1.1.1.1', '1.0.0.1'],
      allowedIps: ['0.0.0.0/0', '::/0'],
      mtu: useStealth ? 1280 : 1420,
      sessionMinutesLimit: user.plan === 'premium' ? null : 30,
      stealth: useStealth,
      multiHop: !!exit,
      failoverUsed,
      provisionMs: Date.now() - provisionStarted,
      server: {
        id: server.id as string,
        name: server.name,
        city: server.city,
        countryCode: server.countryCode,
        region: server.region,
      },
      exit,
    };
  }

  async requestDisconnect(user: UserDocument, dto: DisconnectDto) {
    const server = await this.servers.findActiveById(dto.serverId);
    if (!server) {
      throw new NotFoundException('Server not found');
    }

    await this.safeRevoke(server, dto.clientPublicKey);

    if (dto.exitServerId) {
      const exit = await this.servers.findActiveById(dto.exitServerId);
      if (exit) {
        await this.safeRevoke(exit, dto.clientPublicKey);
      }
    }

    return { ok: true, userId: user.id as string };
  }

  private async resolveExitServer(
    dto: ConnectDto,
    entry: ServerDocument,
    user: UserDocument,
  ) {
    if (dto.exitServerId) {
      const exit = await this.servers.findActiveById(dto.exitServerId);
      if (!exit || exit.status === 'offline') {
        throw new NotFoundException('Exit server unavailable');
      }
      if (exit.premiumOnly && user.plan !== 'premium') {
        throw new ForbiddenException('Premium required for exit server');
      }
      if ((exit.id as string) === (entry.id as string)) {
        throw new ForbiddenException('Exit server must differ from entry');
      }
      return exit;
    }

    const candidates = await this.servers.listPublic(true);
    const pick =
      candidates
        .filter((s) => s.id !== (entry.id as string) && s.status === 'online')
        .sort((a, b) => a.loadPercent - b.loadPercent)[0] ?? null;
    if (!pick) {
      throw new NotFoundException('No suitable exit server');
    }
    const exit = await this.servers.findActiveById(pick.id);
    if (!exit) {
      throw new NotFoundException('Exit server unavailable');
    }
    return exit;
  }

  private async pickFailover(primary: ServerDocument, includePremium: boolean) {
    const list = await this.servers.listPublic(includePremium);
    const candidate = list.find(
      (s) => s.id !== (primary.id as string) && s.status === 'online',
    );
    if (!candidate) return null;
    return this.servers.findActiveById(candidate.id);
  }

  private async tryProvision(server: ServerDocument, clientPublicKey: string) {
    const agentBaseUrl =
      server.agentBaseUrl ||
      this.config.get<string>('DEFAULT_AGENT_URL', 'http://127.0.0.1:4100');

    try {
      const peer = await this.nodes.provisionPeer(agentBaseUrl, clientPublicKey);
      return { ok: true as const, address: peer.address };
    } catch (error) {
      if (this.config.get<string>('ALLOW_CONNECT_WITHOUT_AGENT') === 'true') {
        const octet = this.addressOctet(clientPublicKey);
        return { ok: true as const, address: `10.8.0.${octet}/32` };
      }
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : 'Provision failed',
      };
    }
  }

  private async safeRevoke(server: ServerDocument, clientPublicKey: string) {
    const agentBaseUrl =
      server.agentBaseUrl ||
      this.config.get<string>('DEFAULT_AGENT_URL', 'http://127.0.0.1:4100');
    try {
      await this.nodes.revokePeer(agentBaseUrl, clientPublicKey);
    } catch {
      // best effort
    }
  }

  private endpointFor(server: ServerDocument, stealth: boolean) {
    if (stealth && server.stealthEndpoint) {
      return server.stealthEndpoint;
    }
    return `${server.endpointHost}:${server.endpointPort}`;
  }

  private async enforceDeviceLimit(user: UserDocument, deviceId: string) {
    const existing = await this.devices.findOne({ deviceId }).exec();
    if (existing) {
      if (existing.userId.toString() !== user.id) {
        throw new ForbiddenException('Device belongs to another account');
      }
      existing.lastSeenAt = new Date();
      await existing.save();
      return;
    }

    const count = await this.devices.countDocuments({ userId: user._id });
    if (count >= user.maxDevices) {
      throw new ForbiddenException('Device limit reached for your plan');
    }

    await this.devices.create({
      userId: user._id,
      deviceId,
      lastSeenAt: new Date(),
    });
  }

  private addressOctet(publicKey: string) {
    const hash = createHash('sha256').update(publicKey).digest();
    const n = hash[0] % 250;
    return Math.max(2, n || randomInt(2, 250));
  }
}
