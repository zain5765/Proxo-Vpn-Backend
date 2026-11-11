import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { BrowserService } from './browser.service';
import { BrowserConnectDto } from './dto/browser-connect.dto';
import { BrowserDisconnectDto } from './dto/browser-disconnect.dto';

@Controller('browser')
@UseGuards(JwtAuthGuard)
export class BrowserController {
  constructor(private readonly browser: BrowserService) {}

  @Post('connect')
  connect(
    @Req() req: Request & { user: UserDocument },
    @Body() dto: BrowserConnectDto,
  ) {
    return this.browser.connect(req.user, dto);
  }

  @Post('disconnect')
  disconnect(
    @Req() req: Request & { user: UserDocument },
    @Body() dto: BrowserDisconnectDto,
  ) {
    return this.browser.disconnect(req.user, dto);
  }
}
