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
} from '@nestjs/common';
import { MangaService } from './manga.service';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';

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

  @Post(':id')
  @UsePipes(new ValidationPipe())
  async createManga(@Body() createMangaDto: CreateMangaDto, @Req() req: any, @Param('id') id: string) {
    await this.verifyToken(req)
    const authorId = new Types.ObjectId(id);
    return await this.mangaService.createManga(createMangaDto, authorId)
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  async updateManga(
    @Param('id') id: string,
    @Body() updateMangaDto: UpdateMangaDto,
    @Req() req: any,
  ) {
    const authorId = await this.verifyToken(req);
    return await this.mangaService.updateManga(id, updateMangaDto, authorId);
  }

  @Delete(':id')
  async deleteManga(@Param('id') id: string, @Req() req: any) {
    const authorId = await this.verifyToken(req);
    return await this.mangaService.deleteManga(id, authorId);
  }

  @Get(':id')
  async getAllMangasByAuthor(@Req() req: any, @Param('id') id: string) {
    await this.verifyToken(req);
    const authorId = new Types.ObjectId(id);
    return await this.mangaService.getAllMangasByAuthor(authorId);
  }
}
