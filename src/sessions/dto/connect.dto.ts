import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ConnectDto {
  @IsString()
  serverId!: string;

  @IsString()
  @MinLength(8)
  deviceId!: string;

  @IsString()
  @MinLength(32)
  clientPublicKey!: string;

  /** Premium: chain through a second hop (exit node). */
  @IsOptional()
  @IsBoolean()
  multiHop?: boolean;

  @IsOptional()
  @IsString()
  exitServerId?: string;

  /** Prefer stealth/obfuscated endpoint when available. */
  @IsOptional()
  @IsBoolean()
  stealth?: boolean;

  /** Allow API to pick a failover server if primary agent is down. */
  @IsOptional()
  @IsBoolean()
  allowFailover?: boolean;
}
