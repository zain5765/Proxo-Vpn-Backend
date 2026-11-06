import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { ServersService } from './servers.service';

@Controller('servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get()
  listPublic() {
    return this.servers.listPublic(false);
  }

  @UseGuards(JwtAuthGuard)
  @Get('available')
  listForUser(@Req() req: Request & { user: UserDocument }) {
    const includePremium = req.user.plan === 'premium';
    return this.servers.listPublic(includePremium);
  }

  @UseGuards(JwtAuthGuard)
  @Get('smart')
  smart(@Req() req: Request & { user: UserDocument }) {
    const includePremium = req.user.plan === 'premium';
    return this.servers.smartPick(includePremium);
  }
}
