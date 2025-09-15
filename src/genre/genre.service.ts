import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Genres, GenresDocument } from '../schemas/Genres.schema';

@Injectable()
export class GenreService {
    constructor(@InjectModel(Genres.name) private genreModel: Model<GenresDocument>) {}

    async getAllGenres() {
        return await this.genreModel.find().sort({ name: 1 });
    }

    async createGenre(name: string) {
        const newGenre = new this.genreModel({ name });
        return await newGenre.save();
    }

    async createMultipleGenres(genres: string[]) {
        const genreDocs = genres.map(name => ({ name }));
        return await this.genreModel.insertMany(genreDocs);
    }

    async deleteGenre(id: string) {
        return await this.genreModel.findByIdAndDelete(id);
    }
}
