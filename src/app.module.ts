import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from './admin/admin.module';
import { AdsModule } from './ads/ads.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BrowserModule } from './browser/browser.module';
import { RateLimitMiddleware } from './common/rate-limit.middleware';
import { createMongoOptions } from './database/mongo.factory';
import { FeaturesModule } from './features/features.module';
import { HealthController } from './health.controller';
import { ServersModule } from './servers/servers.module';
import { SessionsModule } from './sessions/sessions.module';
import { StatusModule } from './status/status.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createMongoOptions,
    }),
    AuthModule,
    ServersModule,
    SessionsModule,
    BrowserModule,
    BillingModule,
    AdsModule,
    AdminModule,
    FeaturesModule,
    StatusModule,
    TelemetryModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('auth', 'sessions', 'browser', 'billing', 'webhooks');
  }
}
