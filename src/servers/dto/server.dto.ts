import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertServerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  countryCode!: string;

  @IsString()
  city!: string;

  @IsString()
  region!: string;

  @IsString()
  endpointHost!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  endpointPort?: number;

  @IsString()
  @MinLength(16)
  publicKey!: string;

  @IsOptional()
  @IsString()
  agentBaseUrl?: string;

  @IsOptional()
  @IsBoolean()
  premiumOnly?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['online', 'degraded', 'offline'])
  status?: 'online' | 'degraded' | 'offline';

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  loadPercent?: number;
}
