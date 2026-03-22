import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class AcceptRightsDeclarationDto {
  @IsBoolean()
  accepted: boolean;

  @IsString()
  @MaxLength(30)
  declarationVersion: string;
}