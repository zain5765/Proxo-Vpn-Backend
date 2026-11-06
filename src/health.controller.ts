import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'horse-vpn-api',
      version: '0.1.0',
    };
  }
}
