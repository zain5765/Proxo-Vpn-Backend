import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.header('x-admin-key');
    const expected = this.config.get<string>('ADMIN_API_KEY', 'horse-admin-dev');
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
