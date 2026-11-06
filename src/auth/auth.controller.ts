import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { GuestDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('guest')
  guest(@Body() dto: GuestDto) {
    return this.auth.guest(dto.deviceId);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: UserDocument }) {
    const user = req.user;
    return {
      id: user.id as string,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      maxDevices: user.maxDevices,
    };
  }
}
