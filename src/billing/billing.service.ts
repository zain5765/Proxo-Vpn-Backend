import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { isPremiumProduct, PLANS } from './plans';

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  listPlans() {
    return {
      free: PLANS.free,
      premium: [PLANS.premium_monthly, PLANS.premium_yearly],
      revenueCat: {
        entitlementId: 'premium',
        offeringHint: 'default',
      },
    };
  }

  async linkRevenueCatUser(userId: string, appUserId: string) {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.revenueCatAppUserId = appUserId;
    await user.save();
    return {
      ok: true,
      userId: user.id as string,
      revenueCatAppUserId: appUserId,
    };
  }

  async grantPremium(
    userId: string,
    opts: {
      source: User['subscriptionSource'];
      days?: number;
      externalId?: string;
    },
  ) {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const days = opts.days ?? 30;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);

    user.plan = 'premium';
    user.maxDevices = 5;
    user.subscriptionExpiresAt = expires;
    user.subscriptionSource = opts.source ?? 'admin';
    if (opts.externalId && opts.source === 'revenuecat') {
      user.revenueCatAppUserId = opts.externalId;
    }
    if (opts.externalId && opts.source === 'stripe') {
      user.stripeCustomerId = opts.externalId;
    }
    await user.save();
    return this.toEntitlement(user);
  }

  async revokePremium(userId: string) {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.plan = 'free';
    user.maxDevices = 1;
    user.subscriptionExpiresAt = undefined;
    user.subscriptionSource = 'none';
    await user.save();
    return this.toEntitlement(user);
  }

  async handleRevenueCatEvent(body: Record<string, unknown>) {
    const event = (body.event ?? body) as Record<string, unknown>;
    const appUserId = String(event.app_user_id ?? event.appUserId ?? '');
    const type = String(event.type ?? body.type ?? '');
    const productId = String(
      event.product_id ?? event.productId ?? body.product_id ?? '',
    );

    if (!appUserId) {
      return { ok: false, reason: 'missing app_user_id' };
    }

    let user =
      (await this.users.findOne({ revenueCatAppUserId: appUserId }).exec()) ||
      (await this.users.findOne({ email: appUserId.toLowerCase() }).exec());

    if (!user && /^[a-f\d]{24}$/i.test(appUserId)) {
      user = await this.users.findById(appUserId).exec();
    }

    if (!user) {
      return { ok: false, reason: 'user_not_found' };
    }

    const premiumEvent = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'PRODUCT_CHANGE',
      'NON_RENEWING_PURCHASE',
    ].includes(type.toUpperCase());

    const expireEvent = ['EXPIRATION', 'CANCELLATION'].includes(
      type.toUpperCase(),
    );

    if (premiumEvent && (isPremiumProduct(productId) || !productId)) {
      await this.grantPremium(user.id as string, {
        source: 'revenuecat',
        days: 31,
        externalId: appUserId,
      });
      return { ok: true, plan: 'premium' };
    }

    if (expireEvent) {
      await this.revokePremium(user.id as string);
      return { ok: true, plan: 'free' };
    }

    return { ok: true, ignored: true, type };
  }

  async handleStripeEvent(body: Record<string, unknown>) {
    const type = String(body.type ?? '');
    const data = (body.data as { object?: Record<string, unknown> })?.object;
    const customerId = String(data?.customer ?? '');
    const email = String(
      (data?.customer_email as string) ||
        (data?.receipt_email as string) ||
        '',
    );

    let user: UserDocument | null = null;
    if (customerId) {
      user = await this.users.findOne({ stripeCustomerId: customerId }).exec();
    }
    if (!user && email) {
      user = await this.users.findOne({ email: email.toLowerCase() }).exec();
    }
    if (!user) {
      return { ok: false, reason: 'user_not_found' };
    }

    if (
      type === 'customer.subscription.created' ||
      type === 'customer.subscription.updated' ||
      type === 'checkout.session.completed' ||
      type === 'invoice.paid'
    ) {
      if (customerId) {
        user.stripeCustomerId = customerId;
      }
      await this.grantPremium(user.id as string, {
        source: 'stripe',
        days: 31,
        externalId: customerId || undefined,
      });
      return { ok: true, plan: 'premium' };
    }

    if (
      type === 'customer.subscription.deleted' ||
      type === 'invoice.payment_failed'
    ) {
      await this.revokePremium(user.id as string);
      return { ok: true, plan: 'free' };
    }

    return { ok: true, ignored: true, type };
  }

  async entitlementFor(user: UserDocument) {
    if (
      user.plan === 'premium' &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() < Date.now()
    ) {
      return this.revokePremium(user.id as string);
    }
    return this.toEntitlement(user);
  }

  async countPremium() {
    return this.users.countDocuments({ plan: 'premium' });
  }

  private toEntitlement(user: UserDocument) {
    const premium = user.plan === 'premium';
    return {
      plan: user.plan,
      maxDevices: user.maxDevices,
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
      subscriptionSource: user.subscriptionSource ?? 'none',
      features: {
        ads: !premium,
        allLocations: premium,
        multiHop: premium,
        sessionMinutes: premium ? null : PLANS.free.sessionMinutes,
        splitTunneling: true,
        killSwitch: true,
      },
    };
  }
}
