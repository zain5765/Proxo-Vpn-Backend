import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ServersModule } from '../servers/servers.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [ServersModule, BillingModule, TelemetryModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
