import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NodeAgentClient } from '../nodes/node-agent.client';
import { UpsertServerDto } from './dto/server.dto';
import { Server, ServerDocument } from './schemas/server.schema';

const DEFAULT_AGENT = 'http://127.0.0.1:4100';

const SEED_SERVERS: Partial<Server>[] = [
  {
    name: 'US East',
    countryCode: 'US',
    city: 'New York',
    region: 'us-east',
    endpointHost: 'us-east.proxovpn.local',
    endpointPort: 51820,
    publicKey: 'dwgwd7Snxs69h0UKELtILcar/0Ny7gaBdviGXjODnpw=',
    agentBaseUrl: DEFAULT_AGENT,
    loadPercent: 22,
    premiumOnly: false,
    tags: ['streaming'],
    status: 'online',
    active: true,
  },
  {
    name: 'UK London',
    countryCode: 'GB',
    city: 'London',
    region: 'eu-west',
    endpointHost: 'uk.proxovpn.local',
    endpointPort: 51820,
    publicKey: 'YmJWL1EYyXrcB2tQIMkYzH1ow44rWWXRLfeHfWCXkgU=',
    agentBaseUrl: DEFAULT_AGENT,
    loadPercent: 31,
    premiumOnly: false,
    tags: [],
    status: 'online',
    active: true,
  },
  {
    name: 'Germany Frankfurt',
    countryCode: 'DE',
    city: 'Frankfurt',
    region: 'eu-central',
    endpointHost: 'de.proxovpn.local',
    endpointPort: 51820,
    publicKey: '/aDBAlQO5lqDQiIrtAREiCr/bbE0X+CbYRotII2FUkM=',
    agentBaseUrl: DEFAULT_AGENT,
    loadPercent: 18,
    premiumOnly: false,
    tags: ['low-latency'],
    status: 'online',
    active: true,
  },
  {
    name: 'Singapore',
    countryCode: 'SG',
    city: 'Singapore',
    region: 'ap-southeast',
    endpointHost: 'sg.proxovpn.local',
    endpointPort: 51820,
    publicKey: 'jELKYtkCtY3qXVPacl5Nbxnrp3FrWCkm4hiO34rSmk8=',
    agentBaseUrl: DEFAULT_AGENT,
    loadPercent: 40,
    premiumOnly: true,
    tags: ['streaming'],
    status: 'online',
    active: true,
  },
  {
    name: 'Japan Tokyo',
    countryCode: 'JP',
    city: 'Tokyo',
    region: 'ap-northeast',
    endpointHost: 'jp.proxovpn.local',
    endpointPort: 51820,
    publicKey: '23xjTJJMjQjP8lFKED+f50mQdqFsslNSNkXYL7fOIuQ=',
    agentBaseUrl: DEFAULT_AGENT,
    loadPercent: 27,
    premiumOnly: true,
    tags: ['gaming'],
    status: 'online',
    active: true,
  },
];

@Injectable()
export class ServersService implements OnModuleInit {
  constructor(
    @InjectModel(Server.name) private readonly servers: Model<ServerDocument>,
    private readonly nodes: NodeAgentClient,
  ) {}

  async onModuleInit() {
    // Demo cities (Frankfurt/London/…) are opt-in only. Real nodes are
    // registered via infra/wireguard/register-server.sh.
    if (process.env.SEED_DEMO_SERVERS !== 'true') {
      await this.servers.deleteMany({
        endpointHost: /\.proxovpn\.local$/i,
      });
      return;
    }

    const count = await this.servers.countDocuments();
    if (count === 0) {
      await this.servers.insertMany(SEED_SERVERS);
      return;
    }

    // Keep seed public keys WireGuard-valid (32-byte base64) for native clients.
    for (const seed of SEED_SERVERS) {
      if (!seed.name || !seed.publicKey) continue;
      await this.servers.updateMany(
        {
          name: seed.name,
          $or: [
            { publicKey: { $regex: /REPLACE_ME|^SEED_/ } },
            { publicKey: { $exists: true } },
          ],
        },
        { $set: { publicKey: seed.publicKey } },
      );
    }
  }

  toPublic(s: {
    _id: unknown;
    name: string;
    countryCode: string;
    city: string;
    region: string;
    loadPercent: number;
    premiumOnly: boolean;
    tags: string[];
    status: 'online' | 'degraded' | 'offline';
  }) {
    return {
      id: String(s._id),
      name: s.name,
      countryCode: s.countryCode,
      city: s.city,
      region: s.region,
      loadPercent: s.loadPercent,
      premiumOnly: s.premiumOnly,
      tags: s.tags,
      status: s.status,
    };
  }

  async listPublic(includePremium: boolean) {
    const filter: Record<string, unknown> = {
      active: true,
      status: { $ne: 'offline' as const },
    };
    if (!includePremium) {
      filter.premiumOnly = false;
    }

    // Hide fake *.proxovpn.local seeds once a real node is registered,
    // or when HIDE_SEED_SERVERS=true.
    const hideSeeds =
      process.env.HIDE_SEED_SERVERS === 'true' ||
      (await this.servers.exists({
        active: true,
        endpointHost: { $not: /\.proxovpn\.local$/i },
      }));
    if (hideSeeds) {
      filter.endpointHost = { $not: /\.proxovpn\.local$/i };
    }

    const rows = await this.servers
      .find(filter)
      .sort({ loadPercent: 1, region: 1 })
      .lean()
      .exec();

    return rows.map((s) => this.toPublic(s));
  }

  async smartPick(includePremium: boolean) {
    const list = await this.listPublic(includePremium);
    return (
      [...list]
        .filter((s) => s.status === 'online')
        .sort((a, b) => a.loadPercent - b.loadPercent)[0] ?? null
    );
  }

  async findActiveById(id: string) {
    return this.servers.findOne({ _id: id, active: true }).exec();
  }

  async listAdmin() {
    const rows = await this.servers.find().sort({ region: 1 }).lean().exec();
    return rows.map((s) => ({
      ...this.toPublic(s),
      endpointHost: s.endpointHost,
      endpointPort: s.endpointPort,
      publicKey: s.publicKey,
      agentBaseUrl: s.agentBaseUrl ?? null,
      active: s.active,
    }));
  }

  async create(dto: UpsertServerDto) {
    const created = await this.servers.create({
      ...dto,
      endpointPort: dto.endpointPort ?? 51820,
      loadPercent: dto.loadPercent ?? 0,
      premiumOnly: dto.premiumOnly ?? false,
      tags: dto.tags ?? [],
      status: dto.status ?? 'online',
      active: dto.active ?? true,
    });
    return this.toPublic(created.toObject());
  }

  async update(id: string, dto: Partial<UpsertServerDto>) {
    const updated = await this.servers
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException('Server not found');
    }
    return this.toPublic(updated);
  }

  async remove(id: string) {
    const res = await this.servers.findByIdAndDelete(id).exec();
    if (!res) {
      throw new NotFoundException('Server not found');
    }
    return { ok: true };
  }

  async refreshHealth() {
    const rows = await this.servers.find({ active: true }).exec();
    let peersTotal = 0;
    const results = [];

    for (const server of rows) {
      const agentUrl = server.agentBaseUrl || DEFAULT_AGENT;
      const stats = await this.nodes.fetchStats(agentUrl);
      if (stats) {
        server.loadPercent = stats.loadPercent;
        server.status = stats.loadPercent > 85 ? 'degraded' : 'online';
        peersTotal += stats.peers;
        await server.save();
        results.push({
          id: server.id as string,
          name: server.name,
          loadPercent: server.loadPercent,
          status: server.status,
          peers: stats.peers,
          reachable: true,
        });
      } else {
        server.status = 'degraded';
        await server.save();
        results.push({
          id: server.id as string,
          name: server.name,
          loadPercent: server.loadPercent,
          status: server.status,
          peers: null,
          reachable: false,
        });
      }
    }

    return {
      peersTotal,
      servers: results,
      activeServers: rows.filter((s) => s.status !== 'offline').length,
    };
  }

  async countActive() {
    return this.servers.countDocuments({ active: true, status: { $ne: 'offline' } });
  }
}
