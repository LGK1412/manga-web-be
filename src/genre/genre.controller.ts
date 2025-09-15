import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { GenreService } from './genre.service';

@Controller('api/genre')
export class GenreController {
    constructor(private readonly genreService: GenreService) {}

    @Get()
    async getAllGenres() {
        return await this.genreService.getAllGenres();
    }

    @Post()
    async createGenre(@Body() body: { name: string }) {
        return await this.genreService.createGenre(body.name);
    }

    @Post('bulk')
    async createMultipleGenres(@Body() body: { genres: string[] }) {
        return await this.genreService.createMultipleGenres(body.genres);
    }

    @Delete(':id')
    async deleteGenre(@Param('id') id: string) {
        return await this.genreService.deleteGenre(id);
    }
}

