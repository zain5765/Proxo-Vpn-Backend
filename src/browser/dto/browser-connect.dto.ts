import { IsString, MinLength } from 'class-validator';

export class BrowserConnectDto {
  @IsString()
  serverId!: string;

  @IsString()
  @MinLength(8)
  deviceId!: string;
}
