import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'proxo-vpn-api',
      version: '0.1.0',
    };
  }
}
