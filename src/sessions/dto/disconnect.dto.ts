import { IsOptional, IsString, MinLength } from 'class-validator';

export class DisconnectDto {
  @IsString()
  serverId!: string;

  @IsString()
  @MinLength(32)
  clientPublicKey!: string;

  @IsOptional()
  @IsString()
  exitServerId?: string;
}
