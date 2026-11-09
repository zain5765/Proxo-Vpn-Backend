import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwt: JwtService,
  ) {}

  async guest(deviceId: string) {
    const email = `guest-${deviceId.toLowerCase()}@proxovpn.local`;
    let user = await this.users.findOne({ email }).exec();
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
      user = await this.users.create({
        email,
        passwordHash,
        displayName: 'Guest',
        plan: 'free',
        maxDevices: 1,
      });
    }
    return this.issueTokens(user);
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      displayName: dto.displayName,
      plan: 'free',
      maxDevices: 1,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.banned) {
      throw new UnauthorizedException('Account suspended');
    }

    return this.issueTokens(user);
  }

  private issueTokens(user: UserDocument) {
    const payload = { sub: user.id as string, email: user.email };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      refreshToken: accessToken,
      user: {
        id: user.id as string,
        email: user.email,
        displayName: user.displayName,
        plan: user.plan,
        maxDevices: user.maxDevices,
      },
    };
  }
}
