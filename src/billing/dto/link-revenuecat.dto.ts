import { IsString, MinLength } from 'class-validator';

export class LinkRevenueCatDto {
  @IsString()
  @MinLength(3)
  appUserId!: string;
}
