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
} from '@nestjs/common';
import { MangaService } from './manga.service';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

// FileInterceptor config cho cover image
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

  private verifyToken(req: any): Promise<string> {
    const token = req.cookies?.access_token;
    if (!token) {
      throw new BadRequestException(
        'Authentication required - no access token',
      );
    }

    try {
      const decoded = this.jwtService.verify(token);
      return decoded.user_id;
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  @Get(':authorId')
  async getAllMangasByAuthorId(@Param('authorId') authorId: string) {
    return await this.mangaService.getAllMangasByAuthor(new Types.ObjectId(authorId));
  }

  @Post(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('coverImage', {
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
    }),
  )
  async createManga(
    @Body() createMangaDto: CreateMangaDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    await this.verifyToken(req)
    const authorId = new Types.ObjectId(id);

    // Nếu có file upload, lưu trực tiếp
    if (file) {
      createMangaDto.coverImage = file.filename;
    }

    return await this.mangaService.createManga(createMangaDto, authorId)
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseInterceptors(
    FileInterceptor('coverImage', {
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
    }),
  )
  async updateManga(
    @Param('id') id: string,
    @Body() updateMangaDto: UpdateMangaDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const authorId = await this.verifyToken(req);

    // Nếu có file upload, lưu trực tiếp
    if (file) {
      updateMangaDto.coverImage = file.filename;
    }

    return await this.mangaService.updateManga(id, updateMangaDto, new Types.ObjectId(authorId));
  }

  @Post(':id/toggle-delete')
  async toggleDelete(@Param('id') id: string, @Req() req: any) {
    const authorId = await this.verifyToken(req);
    return await this.mangaService.toggleDelete(id, new Types.ObjectId(authorId));
  }
  @Get('get/all')
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '24',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 24)); // cap 100
    const { data, total } = await this.mangaService.getAllManga(p, l);
    return { data, total, page: p, limit: l }; // chuẩn REST
  }
}


