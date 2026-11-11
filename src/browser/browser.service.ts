import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { NodeAgentClient } from '../nodes/node-agent.client';
import { ServersService } from '../servers/servers.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { Device, DeviceDocument } from '../users/schemas/device.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { ServerDocument } from '../servers/schemas/server.schema';
import { BrowserConnectDto } from './dto/browser-connect.dto';
import { BrowserDisconnectDto } from './dto/browser-disconnect.dto';

@Injectable()
export class BrowserService {
  constructor(
    private readonly servers: ServersService,
    private readonly nodes: NodeAgentClient,
    private readonly config: ConfigService,
    private readonly telemetry: TelemetryService,
    @InjectModel(Device.name) private readonly devices: Model<DeviceDocument>,
  ) {}

  async connect(user: UserDocument, dto: BrowserConnectDto) {
    const started = Date.now();
    try {
      const result = await this.connectInternal(user, dto);
      await this.telemetry.track({
        type: 'connect_success',
        region: result.server.region,
        durationMs: Date.now() - started,
        premium: user.plan === 'premium',
      });
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

  private async connectInternal(user: UserDocument, dto: BrowserConnectDto) {
    const server = await this.servers.findActiveById(dto.serverId);
    if (!server || server.status === 'offline') {
      throw new NotFoundException('Server unavailable');
    }
    if (server.premiumOnly && user.plan !== 'premium') {
      throw new ForbiddenException('Premium required for this server');
    }

    await this.enforceDeviceLimit(user, dto.deviceId);

    const sessionMinutesLimit = user.plan === 'premium' ? null : 30;
    const ttlSeconds =
      sessionMinutesLimit == null ? null : sessionMinutesLimit * 60;
    const username = this.socksUsername(user.id as string, dto.deviceId, dto.serverId);
    const password = randomBytes(18).toString('base64url');

    const agentBaseUrl = this.agentUrl(server);
    const defaultPort = Number(
      this.config.get('HTTP_PROXY_PORT') ??
        this.config.get('SOCKS_PROXY_PORT') ??
        8080,
    );

    let proxyPort = defaultPort;
    let proxyScheme: 'http' | 'socks5' = 'http';
    try {
      const provisioned = await this.nodes.provisionSocksUser(agentBaseUrl, {
        username,
        password,
        ttlSeconds,
      });
      proxyPort = provisioned.proxyPort || defaultPort;
      proxyScheme = provisioned.proxyScheme === 'socks5' ? 'socks5' : 'http';
    } catch (error) {
      if (this.config.get<string>('ALLOW_CONNECT_WITHOUT_AGENT') === 'true') {
        // Dev fallback — credentials will not work until a real agent is up.
        proxyPort = defaultPort;
      } else {
        throw error instanceof ServiceUnavailableException
          ? error
          : new ServiceUnavailableException(
              error instanceof Error ? error.message : 'Proxy provision failed',
            );
      }
    }

    const expiresAt =
      ttlSeconds == null
        ? null
        : new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return {
      proxyHost: server.endpointHost,
      proxyPort,
      proxyScheme,
      username,
      password,
      expiresAt,
      sessionMinutesLimit,
      server: {
        id: server.id as string,
        name: server.name,
        city: server.city,
        countryCode: server.countryCode,
        region: server.region,
      },
    };
  }

  async disconnect(user: UserDocument, dto: BrowserDisconnectDto) {
    const server = await this.servers.findActiveById(dto.serverId);
    if (!server) {
      throw new NotFoundException('Server not found');
    }
    const username = this.socksUsername(
      user.id as string,
      dto.deviceId,
      dto.serverId,
    );
    try {
      await this.nodes.revokeSocksUser(this.agentUrl(server), username);
    } catch {
      // best effort
    }
    return { ok: true };
  }

  private agentUrl(server: ServerDocument) {
    return (
      server.agentBaseUrl ||
      this.config.get<string>('DEFAULT_AGENT_URL', 'http://127.0.0.1:4100')
    );
  }

  private socksUsername(userId: string, deviceId: string, serverId: string) {
    const digest = createHash('sha256')
      .update(`${userId}:${deviceId}:${serverId}`)
      .digest('hex')
      .slice(0, 20);
    return `px_${digest}`;
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
}
