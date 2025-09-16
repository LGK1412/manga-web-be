import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ChapterService } from './text-chapter.service';
import { CreateChapterWithTextDto } from './dto/create-chapter-with-text.dto';
import { UpdateChapterWithTextDto } from './dto/update-chapter-with-text.dto';
import { ChapterDocument } from '../schemas/chapter.schema';
import { TextChapterDocument } from '../schemas/text-chapter.schema';
import { Types } from 'mongoose';

@Controller('api/text-chapter')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() createChapterWithTextDto: CreateChapterWithTextDto,
  ): Promise<{ chapter: ChapterDocument; text: TextChapterDocument }> {
    return this.chapterService.createChapterWithText(createChapterWithTextDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChapterWithTextDto,
  ): Promise<{
    chapter: ChapterDocument | null;
    text: TextChapterDocument | null;
  }> {
    return this.chapterService.updateChapter(new Types.ObjectId(id), dto);
  }

  @Get(':mangaId')
  async getChaptersByMangaId(@Param('mangaId') mangaId: string) {
    return await this.chapterService.getChapterAllByManga_id(
      new Types.ObjectId(mangaId),
    );
  }
  @Get('id/:id')
  async getChapterById(@Param('id') id: string) {
    return await this.chapterService.getChapterById(new Types.ObjectId(id));
  }
  @Delete(':id')
  async deleteChapter(@Param('id') id: string) {
    return this.chapterService.deleteChapterAndText(new Types.ObjectId(id));
  }
}
