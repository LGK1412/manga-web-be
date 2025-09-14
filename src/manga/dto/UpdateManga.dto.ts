import { PartialType } from '@nestjs/mapped-types';
import { CreateMangaDto } from './CreateManga.dto';

export class UpdateMangaDto extends PartialType(CreateMangaDto) {}