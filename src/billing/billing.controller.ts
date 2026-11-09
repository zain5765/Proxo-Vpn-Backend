import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { BillingService } from './billing.service';
import { LinkRevenueCatDto } from './dto/link-revenuecat.dto';

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @Get('billing/plans')
  plans() {
    return this.billing.listPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('billing/entitlement')
  entitlement(@Req() req: Request & { user: UserDocument }) {
    return this.billing.entitlementFor(req.user);
  }

  /** Bind Proxo VPN user ↔ RevenueCat app_user_id (usually our user id or guest email). */
  @UseGuards(JwtAuthGuard)
  @Post('billing/revenuecat/link')
  linkRevenueCat(
    @Req() req: Request & { user: UserDocument },
    @Body() dto: LinkRevenueCatDto,
  ) {
    return this.billing.linkRevenueCatUser(req.user.id as string, dto.appUserId);
  }

  /** Dev/admin helper to unlock Premium without a store purchase. */
  @UseGuards(JwtAuthGuard)
  @Post('billing/dev/grant-premium')
  grantDev(@Req() req: Request & { user: UserDocument }) {
    if (this.config.get('ALLOW_DEV_BILLING') !== 'true') {
      throw new UnauthorizedException('Dev billing disabled');
    }
    return this.billing.grantPremium(req.user.id as string, {
      source: 'dev',
      days: 30,
    });
  }

  @Post('webhooks/revenuecat')
  revenueCat(
    @Headers('authorization') auth: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertWebhookSecret(
      auth?.replace(/^Bearer\s+/i, ''),
      'REVENUECAT_WEBHOOK_SECRET',
    );
    return this.billing.handleRevenueCatEvent(body);
  }

  @Post('webhooks/stripe')
  stripe(
    @Headers('stripe-signature') _sig: string | undefined,
    @Headers('x-horse-webhook-secret') secret: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    // Full Stripe signature verify comes later; shared secret gate for now.
    this.assertWebhookSecret(secret, 'STRIPE_WEBHOOK_SECRET');
    return this.billing.handleStripeEvent(body);
  }

  @Post('admin/users/:id/premium')
  adminGrant(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: { days?: number },
  ) {
    this.assertAdmin(adminKey);
    return this.billing.grantPremium(id, {
      source: 'admin',
      days: body.days ?? 30,
    });
  }

  private assertAdmin(key?: string) {
    const expected = this.config.get<string>('ADMIN_API_KEY', 'horse-admin-dev');
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  private assertWebhookSecret(provided: string | undefined, envKey: string) {
    const expected = this.config.get<string>(envKey);
    if (!expected) {
      return;
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }
}
