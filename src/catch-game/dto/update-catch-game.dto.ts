import { PartialType } from '@nestjs/mapped-types';
import { CreateCatchGameDto } from './create-catch-game.dto';

export class UpdateCatchGameDto extends PartialType(CreateCatchGameDto) {}
