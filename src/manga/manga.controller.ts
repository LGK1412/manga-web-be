import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';

import { MangaService } from './manga.service';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

// Nếu bạn đã tạo OptionalAccessTokenGuard (khuyên dùng) thì dùng để public + optional user
import { OptionalAccessTokenGuard } from 'src/common/guards/optional-access-token.guard';

// Reusable FileInterceptor config
const coverImageInterceptor = FileInterceptor('coverImage', {
  storage: diskStorage({
    destination: 'public/assets/coverImages',
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('File không phải ảnh'), false);
    }
    cb(null, true);
  },
});

@Controller('api/manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  // ================= ADMIN ANALYTICS =================

  @Get('admin/summary')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminSummary() {
    return this.mangaService.adminSummary();
  }

  @Get('admin/charts/monthly-growth')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async monthlyGrowth(@Query('months') months = '6') {
    const m = Math.max(1, Math.min(24, parseInt(months as string, 10) || 6));
    return this.mangaService.monthlyGrowth(m);
  }

  @Get('admin/top')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async topStories(
    @Query('limit') limit = '5',
    @Query('by') by: 'views' | 'recent' = 'views',
  ) {
    const l = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 5));
    return this.mangaService.topStories(l, by);
  }

  // ================= PUBLIC READING =================

  @Get('random')
  async getRandom() {
    const randomManga = await this.mangaService.getRandomManga();
    if (!randomManga) throw new NotFoundException('No story found');
    return randomManga;
  }

  @Get('get/all')
  async getAll(@Query('page') page = '1', @Query('limit') limit = '24') {
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 24));
    const { data, total } = await this.mangaService.getAllManga(p, l);
    return { data, total, page: p, limit: l };
  }

  @Get('/')
  async getAllMangaBasic() {
    return this.mangaService.getAllBasic();
  }

  /**
   * Public: xem chi tiết manga
   * Nếu có token hợp lệ => req.user có userId để cá nhân hoá (history, fav, etc)
   */
  @Get('detail/:id')
  @UseGuards(OptionalAccessTokenGuard)
  async getMangaDetail(@Req() req: Request, @Param('id') id: string) {
    const payload = ((req as any).user ?? null) as JwtPayload | null;
    // JWT payload has user_id, not userId
    const userId = payload ? ((payload as any).user_id || (payload as any).userId) : '';
    return this.mangaService.findMangaDetail(id, userId);
  }

  @Patch('view/:id/increase')
  async viewCounter(@Param('id') id: string) {
    return this.mangaService.ViewCounter(new Types.ObjectId(id));
  }

  /**
   * Recommend theo user
   * Nên bắt login + check mismatch để tránh user xem recommend của người khác
   */
  @Get('recomment/user/:userId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getRecommendStory(@Param('userId') userId: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    // JWT payload has user_id, not userId
    const tokenUserId = (payload as any).user_id || (payload as any).userId;
    if (userId !== tokenUserId) {
      throw new BadRequestException('User ID mismatch');
    }
    return this.mangaService.getRecommendStory(new Types.ObjectId(userId));
  }

  // ================= AUTHOR ACTIONS =================

  /**
   * Tạo manga (AUTHOR/ADMIN)
   * Giữ route cũ: author/:authorId nhưng check mismatch với token
   */
  @Post('author/:authorId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(coverImageInterceptor)
  async createManga(
    @Body() createMangaDto: CreateMangaDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Param('authorId') authorId: string,
  ) {
    const payload = (req as any).user as JwtPayload;
    // JWT payload has user_id, not userId
    const userId = (payload as any).user_id || (payload as any).userId;

    if (userId !== authorId && payload.role !== Role.ADMIN) {
      throw new BadRequestException('You do not have permission to create story for this author');
    }

    if (file) {
      createMangaDto.coverImage = file.filename;
    }

    return this.mangaService.createManga(createMangaDto, new Types.ObjectId(authorId));
  }

  @Patch('update/:mangaId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(coverImageInterceptor)
  async updateManga(
    @Param('mangaId') mangaId: string,
    @Body() updateMangaDto: UpdateMangaDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const payload = (req as any).user as JwtPayload;
    // JWT payload has user_id, not userId
    const userId = (payload as any).user_id || (payload as any).userId;

    if (file) updateMangaDto.coverImage = file.filename;

    return this.mangaService.updateManga(
      mangaId,
      updateMangaDto,
      new Types.ObjectId(userId),
    );
  }

  @Post(':mangaId/toggle-delete')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async toggleDelete(@Param('mangaId') mangaId: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    // JWT payload has user_id, not userId
    const userId = (payload as any).user_id || (payload as any).userId;

    return this.mangaService.toggleDelete(mangaId, new Types.ObjectId(userId));
  }

  @Delete(':mangaId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async deleteManga(@Param('mangaId') mangaId: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    // JWT payload has user_id, not userId
    const userId = (payload as any).user_id || (payload as any).userId;

    return this.mangaService.deleteManga(mangaId, new Types.ObjectId(userId));
  }

  // ================= AUTHOR PUBLIC INFO =================
  // NOTE: để route stats trước route author/:authorId để tránh nhầm lẫn

  @Get('author/:authorId/stats')
  async getAuthorStats(@Param('authorId') authorId: string) {
    return this.mangaService.authorStats(new Types.ObjectId(authorId));
  }

  @Get('author/:authorId')
  async getAllMangasByAuthorId(@Param('authorId') authorId: string) {
    return this.mangaService.getAllMangasByAuthor(new Types.ObjectId(authorId));
  }
}
