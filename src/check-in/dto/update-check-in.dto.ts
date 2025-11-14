import { PartialType } from '@nestjs/mapped-types';
import { CreateCheckInDto } from './create-check-in.dto';

export class UpdateCheckInDto extends PartialType(CreateCheckInDto) {}
