import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ timestamps: true })
export class Device {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  deviceId!: string;

  @Prop()
  platform?: string;

  @Prop()
  name?: string;

  @Prop()
  lastSeenAt?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
