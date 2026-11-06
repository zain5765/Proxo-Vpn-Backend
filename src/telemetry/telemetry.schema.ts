import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TelemetryDocument = HydratedDocument<TelemetryEvent>;

/** Anonymized connect metrics only — never destinations or payloads. */
@Schema({ timestamps: true })
export class TelemetryEvent {
  @Prop({ required: true, index: true })
  type!: 'connect_success' | 'connect_fail' | 'failover' | 'multihop';

  @Prop()
  region?: string;

  @Prop()
  durationMs?: number;

  @Prop()
  reason?: string;

  @Prop({ default: false })
  premium?: boolean;
}

export const TelemetrySchema = SchemaFactory.createForClass(TelemetryEvent);
