import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import { UpsertServerDto } from '../servers/dto/server.dto';
import { ServersService } from '../servers/servers.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly servers: ServersService,
    private readonly billing: BillingService,
    private readonly telemetry: TelemetryService,
  ) {}

  @Get('overview')
  async overview() {
    const health = await this.servers.refreshHealth();
    const premiumUsers = await this.billing.countPremium();
    const metrics = await this.telemetry.recentSummary();
    return {
      activeServers: health.activeServers,
      peersTotal: health.peersTotal,
      premiumUsers,
      servers: health.servers,
      metrics,
    };
  }

  @Get('servers')
  listServers() {
    return this.servers.listAdmin();
  }

  @Post('servers')
  createServer(@Body() dto: UpsertServerDto) {
    return this.servers.create(dto);
  }

  @Patch('servers/:id')
  updateServer(@Param('id') id: string, @Body() dto: Partial<UpsertServerDto>) {
    return this.servers.update(id, dto);
  }

  @Delete('servers/:id')
  deleteServer(@Param('id') id: string) {
    return this.servers.remove(id);
  }

  @Post('servers/refresh-health')
  refresh() {
    return this.servers.refreshHealth();
  }
}
