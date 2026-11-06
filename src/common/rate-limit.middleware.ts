import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit = 60;
  private readonly windowMs = 60_000;

  use(req: Request, _res: Response, next: NextFunction) {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > this.limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return next();
  }
}
