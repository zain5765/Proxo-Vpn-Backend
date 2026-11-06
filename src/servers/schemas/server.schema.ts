import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ServerDocument = HydratedDocument<Server>;

@Schema({ timestamps: true })
export class Server {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  countryCode!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true, index: true })
  region!: string;

  @Prop({ required: true })
  endpointHost!: string;

  @Prop({ default: 51820 })
  endpointPort!: number;

  /** Optional obfuscated / stealth listener (host:port). */
  @Prop()
  stealthEndpoint?: string;

  @Prop({ required: true })
  publicKey!: string;

  @Prop()
  agentBaseUrl?: string;

  @Prop({ default: 0, min: 0, max: 100 })
  loadPercent!: number;

  @Prop({ default: false })
  premiumOnly!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({
    default: 'online',
    enum: ['online', 'degraded', 'offline'],
  })
  status!: 'online' | 'degraded' | 'offline';

  @Prop({ default: true })
  active!: boolean;
}

export const ServerSchema = SchemaFactory.createForClass(Server);
