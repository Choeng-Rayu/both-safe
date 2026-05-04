import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class OpenDisputeDto {
  @IsUUID()
  openedById!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class AddDisputeMessageDto {
  @IsUUID()
  senderId!: string;

  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}
