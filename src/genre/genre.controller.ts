import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { GenreService } from './genre.service';
import { CreateGenreDto } from './dto/CreateGenre.Schema';
import { UpdateGenreDto } from './dto/UpdateGenre.Schema';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/genre')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.CONTENT_MODERATOR, Role.AUTHOR)
export class GenreController {
  constructor(private readonly genreService: GenreService) {}

  @Get()
  async getAllGenres() {
    return await this.genreService.getAllGenres();
  }

  @Get(':id')
  async getGenreById(@Param('id') id: string) {
    return await this.genreService.getGenreById(id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createGenre(@Body() dto: CreateGenreDto) {
    return await this.genreService.createGenre(dto);
  }

  @Post('bulk')
  async createMultipleGenres(@Body() body: { genres: CreateGenreDto[] }) {
    return await this.genreService.createMultipleGenres(body.genres);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateGenre(@Param('id') id: string, @Body() dto: UpdateGenreDto) {
    return await this.genreService.updateGenre(id, dto);
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return await this.genreService.toggleStatus(id);
  }
}