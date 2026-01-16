import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { ChapterService } from './text-chapter.service';
import { CreateChapterWithTextDto } from './dto/create-chapter-with-text.dto';
import { UpdateChapterWithTextDto } from './dto/update-chapter-with-text.dto';
import type { ChapterDocument } from '../schemas/chapter.schema';
import type { TextChapterDocument } from '../schemas/text-chapter.schema';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/text-chapter')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  /**
   * AUTHOR/ADMIN tạo chapter
   */
  @Post()
  @HttpCode(201)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async create(
    @Body() createChapterWithTextDto: CreateChapterWithTextDto,
  ): Promise<{ chapter: ChapterDocument; text: TextChapterDocument }> {
    return this.chapterService.createChapterWithText(createChapterWithTextDto);
  }

  /**
   * AUTHOR/ADMIN update chapter
   */
  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChapterWithTextDto,
  ): Promise<{
    chapter: ChapterDocument | null;
    text: TextChapterDocument | null;
  }> {
    return this.chapterService.updateChapter(new Types.ObjectId(id), dto);
  }

  /**
   * Public: lấy chapter theo id
   * NOTE: đặt trước :mangaId để tránh route bị nuốt
   */
  @Get('id/:id')
  async getChapterById(@Param('id') id: string) {
    return this.chapterService.getChapterById(new Types.ObjectId(id));
  }

  /**
   * Public: lấy tất cả chapter theo mangaId
   */
  @Get(':mangaId')
  async getChaptersByMangaId(@Param('mangaId') mangaId: string) {
    return this.chapterService.getChapterAllByManga_id(
      new Types.ObjectId(mangaId),
    );
  }

  /**
   * AUTHOR/ADMIN xoá chapter
   */
  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async deleteChapter(@Param('id') id: string) {
    return this.chapterService.deleteChapterAndText(new Types.ObjectId(id));
  }
}
