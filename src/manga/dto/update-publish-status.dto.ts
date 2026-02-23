import { IsBoolean } from 'class-validator';

export class UpdatePublishStatusDto {
  @IsBoolean()
  isPublish: boolean;
}