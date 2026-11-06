import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { FeaturesService } from './features.service';

@Controller('features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get()
  publicFlags() {
    return this.features.flagsFor(null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  myFlags(@Req() req: Request & { user: UserDocument }) {
    return this.features.flagsFor(req.user);
  }
}
