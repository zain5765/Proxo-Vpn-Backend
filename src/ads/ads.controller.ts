import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { AdsService } from './ads.service';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get('policy')
  publicPolicy() {
    return this.ads.policyFor(null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('policy/me')
  myPolicy(@Req() req: Request & { user: UserDocument }) {
    return this.ads.policyFor(req.user);
  }
}
