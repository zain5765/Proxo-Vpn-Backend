import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop()
  displayName?: string;

  @Prop({ default: 'free', enum: ['free', 'premium'] })
  plan!: 'free' | 'premium';

  @Prop({ default: 1 })
  maxDevices!: number;

  @Prop({ default: false })
  banned!: boolean;

  @Prop()
  revenueCatAppUserId?: string;

  @Prop()
  stripeCustomerId?: string;

  @Prop()
  subscriptionExpiresAt?: Date;

  @Prop({ default: 'none' })
  subscriptionSource?: 'none' | 'revenuecat' | 'stripe' | 'admin' | 'dev';
}

export const UserSchema = SchemaFactory.createForClass(User);
