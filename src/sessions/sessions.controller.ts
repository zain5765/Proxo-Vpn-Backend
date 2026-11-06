import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { ConnectDto } from './dto/connect.dto';
import { DisconnectDto } from './dto/disconnect.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('connect')
  connect(
    @Req() req: Request & { user: UserDocument },
    @Body() dto: ConnectDto,
  ) {
    return this.sessions.requestConnect(req.user, dto);
  }

  @Post('disconnect')
  disconnect(
    @Req() req: Request & { user: UserDocument },
    @Body() dto: DisconnectDto,
  ) {
    return this.sessions.requestDisconnect(req.user, dto);
  }
}
