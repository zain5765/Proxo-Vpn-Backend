import { IsString, MinLength } from 'class-validator';

export class BrowserDisconnectDto {
  @IsString()
  serverId!: string;

  @IsString()
  @MinLength(8)
  deviceId!: string;
}
