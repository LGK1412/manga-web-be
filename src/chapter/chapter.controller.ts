import {
  Controller,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { ChapterServiceOnlyNormalChapterInfor } from './chapter.service';
import { Types } from 'mongoose';

@Controller('api/chapter')
export class ChapterController {
  constructor(
    private readonly chapterService: ChapterServiceOnlyNormalChapterInfor,
  ) {}

  // ================== CHAPTER LIST ==================

  @Get()
  async getAllchapter() {
    // [31/10/2025] getAllChapter() đã nới lọc để không trả mảng rỗng
    return this.chapterService.getAllChapter();
  }

  // [31/10/2025] NEW: lấy chapter theo mangaId – phục vụ dropdown FE trực tiếp
  @Get('by-manga/:id')
  async getChaptersByManga(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('mangaId không hợp lệ');
    }
    return this.chapterService.findChaptersByMangaId(id);
  }

  // ================== CHAPTER DETAIL ==================

  @Get('content/:id')
  async getChapterContentById(@Param('id') id: string) {
    return await this.chapterService.getChapterCompact(new Types.ObjectId(id));
  }

  @Get('checkchapter/:id')
  async checkChapterHaveNextOrPre(@Param('id') id: string) {
    return await this.chapterService.checkChapterHaveNextOrPre(
      new Types.ObjectId(id),
    );
  }

  @Get('checkchapterList/:id')
  async getChapterList(@Param('id') id: string) {
    // [31/10/2025] unify type: nhận string rồi wrap sang ObjectId trong service
    return await this.chapterService.getChapterList(new Types.ObjectId(id));
  }

  // ================== CHAPTER PROGRESS ==================

  @Get('progress/:userId/:chapterId')
  async getOrUpdateChapterProgress(
    @Param('userId') userId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.chapterService.getOrUpdateChapterProgress(
      new Types.ObjectId(userId),
      new Types.ObjectId(chapterId),
    );
  }

  @Post('progress/:userId/:chapterId/:percent')
  async createChapterProgress(
    @Param('userId') userId: string,
    @Param('chapterId') chapterId: string,
    @Param('percent', ParseFloatPipe) percent: number,
  ) {
    return this.chapterService.createChapterProgress(
      new Types.ObjectId(userId),
      new Types.ObjectId(chapterId),
      percent,
    );
  }

  // ================== HISTORY ==================

  @Get('history/user/:userId')
  async getReadingHistoryListByUser(@Param('userId') userId: string) {
    return this.chapterService.getReadingHistoryListByUser(
      new Types.ObjectId(userId),
    );
  }

  @Get('history/:userId/:storyId')
  async getLastReadChapterFromHistory(
    @Param('userId') userId: string,
    @Param('storyId') storyId: string,
  ) {
    return this.chapterService.getLastReadChapterFromHistory(
      new Types.ObjectId(userId),
      new Types.ObjectId(storyId),
    );
  }

  @Post('history/:userId/:storyId')
  async createStoryHistory(
    @Param('userId') userId: string,
    @Param('storyId') storyId: string,
  ) {
    return this.chapterService.createStoryHistory(
      new Types.ObjectId(userId),
      new Types.ObjectId(storyId),
    );
  }

  @Delete('history/:userId/:storyId')
  async deleteStoryHistory(
    @Param('userId') userId: string,
    @Param('storyId') storyId: string,
  ) {
    return this.chapterService.deleteStoryHistory(
      new Types.ObjectId(userId),
      new Types.ObjectId(storyId),
    );
  }

  // ================== FALLBACK BY ID ==================

  // [31/10/2025] DI CHUYỂN XUỐNG CUỐI: tránh “bóng đè” lên các route tĩnh như content/..., checkchapter/...
  @Get(':id')
  async getChapterById(@Param('id') id: string) {
    return await this.chapterService.getChapterById(new Types.ObjectId(id));
  }
}
