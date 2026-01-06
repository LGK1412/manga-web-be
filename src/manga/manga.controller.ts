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
import { MangaService } from './manga.service';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AccessTokenGuard } from 'Guards/access-token.guard';

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
  constructor(
    private mangaService: MangaService,
    private jwtService: JwtService,
  ) { }


  // ====== ADMIN ANALYTICS: SUMMARY ======
  @Get('admin/summary')
  async adminSummary() {
    return this.mangaService.adminSummary();
  }

  // ====== ADMIN ANALYTICS: MONTHLY GROWTH ======
  @Get('admin/charts/monthly-growth')
  async monthlyGrowth(@Query('months') months = '6') {
    const m = Math.max(1, Math.min(24, parseInt(months as string, 10) || 6));
    return this.mangaService.monthlyGrowth(m);
  }

  // ====== ADMIN ANALYTICS: TOP STORIES ======
  @Get('admin/top')
  async topStories(
    @Query('limit') limit = '5',
    @Query('by') by: 'views' | 'recent' = 'views',
  ) {
    const l = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 5));
    return this.mangaService.topStories(l, by);
  }

  // ====== RANDOM ======
  @Get('random')
  async getRandom() {
    const randomManga = await this.mangaService.getRandomManga();
    if (!randomManga) throw new NotFoundException('Không tìm thấy truyện nào');
    return randomManga;
  }

  // ====== PAGINATED LIST ======
  @Get('get/all')
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '24',
  ) {
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 24));
    const { data, total } = await this.mangaService.getAllManga(p, l);
    return { data, total, page: p, limit: l };
  }

  // ====== BASIC LIST ======
  @Get('/')
  async getAllMangaBasic() {
    return this.mangaService.getAllBasic();
  }

  @Get('detail/:id')
  async getMangaDetail(@Req() req, @Param('id') id: string) {
    let userId = '';
    const payload = (req as any).user;
    if (payload) {
      userId = payload.user_id;
    }
    return await this.mangaService.findMangaDetail(id, userId);
  }

  // ====== VIEW COUNTER ======
  @Patch('view/:id/increase')
  async ViewCounter(@Param('id') id: string) {
    return await this.mangaService.ViewCounter(new Types.ObjectId(id));
  }

  // ====== RECOMMEND ======
  @Get('recomment/user/:userId')
  async getRecommentStory(@Param('userId') userId: string) {
    return await this.mangaService.getRecommendStory(new Types.ObjectId(userId));
  }

  @Post('author/:authorId')
  @UseGuards(AccessTokenGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(coverImageInterceptor)
  async createManga(
    @Body() createMangaDto: CreateMangaDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Param('authorId') authorId: string,
  ) {
    const payload = (req as any).user;
    const userId = payload.user_id;
    if (userId !== authorId) {
      throw new BadRequestException('Không có quyền tạo truyện cho author này');
    }

    if (file) {
      createMangaDto.coverImage = file.filename;
    }

    return await this.mangaService.createManga(
      createMangaDto,
      new Types.ObjectId(authorId),
    );
  }

  @Patch('update/:mangaId')
  @UseGuards(AccessTokenGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(coverImageInterceptor)
  async updateManga(
    @Param('mangaId') mangaId: string,
    @Body() updateMangaDto: UpdateMangaDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const payload = (req as any).user;
    const userId = payload.user_id;
    if (file) updateMangaDto.coverImage = file.filename;

    return await this.mangaService.updateManga(
      mangaId,
      updateMangaDto,
      new Types.ObjectId(userId),
    );
  }

  @Post('toggle-delete/:mangaId')
  @UseGuards(AccessTokenGuard)
  async toggleDelete(@Param('mangaId') mangaId: string, @Req() req: any) {
    const payload = (req as any).user;
    const userId = payload.user_id;
    return await this.mangaService.toggleDelete(
      mangaId,
      new Types.ObjectId(userId),
    );
  }

  @Delete(':mangaId')
  @UseGuards(AccessTokenGuard)
  async deleteManga(@Param('mangaId') mangaId: string, @Req() req: any) {
    const payload = (req as any).user;
    const userId = payload.user_id;
    return await this.mangaService.deleteManga(
      mangaId,
      new Types.ObjectId(userId),
    );
  }

  // ====== AUTHOR (phải ở cuối để tránh wildcard conflict) ======
  @Get('author/:authorId')
  async getAllMangasByAuthorId(@Param('authorId') authorId: string) {
    return await this.mangaService.getAllMangasByAuthor(
      new Types.ObjectId(authorId),
    );
  }

  @Get('author/:authorId/stats')
  async getAuthorStats(@Param('authorId') authorId: string) {
    return this.mangaService.authorStats(new Types.ObjectId(authorId));
  }
}
