import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TelemetryEvent, TelemetryDocument } from './telemetry.schema';

@Injectable()
export class TelemetryService {
  constructor(
    @InjectModel(TelemetryEvent.name)
    private readonly events: Model<TelemetryDocument>,
  ) {}

  async track(input: {
    type: TelemetryEvent['type'];
    region?: string;
    durationMs?: number;
    reason?: string;
    premium?: boolean;
  }) {
    await this.events.create(input);
  }

  async recentSummary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.events
      .find({ createdAt: { $gte: since } } as Record<string, unknown>)
      .lean()
      .exec();
    const success = rows.filter((r) => r.type === 'connect_success').length;
    const fail = rows.filter((r) => r.type === 'connect_fail').length;
    const total = success + fail;
    const avgMs =
      rows
        .filter((r) => typeof r.durationMs === 'number')
        .reduce((a, r) => a + (r.durationMs || 0), 0) /
      Math.max(
        1,
        rows.filter((r) => typeof r.durationMs === 'number').length,
      );

    return {
      windowHours: 24,
      connectSuccessRate: total ? success / total : 1,
      connectAttempts: total,
      avgConnectMs: Math.round(avgMs),
      failovers: rows.filter((r) => r.type === 'failover').length,
      multihops: rows.filter((r) => r.type === 'multihop').length,
    };
  }
}
