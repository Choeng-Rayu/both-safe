import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class AdminDecisionDto {
  @IsUUID()
  adminId!: string;

  @IsIn(['release', 'refund'])
  decision!: 'release' | 'refund';

  @IsOptional()
  @IsString()
  note?: string;
}
