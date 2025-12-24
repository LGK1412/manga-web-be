import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Genres, GenresDocument } from '../schemas/Genres.schema';
import { Manga, MangaDocument } from '../schemas/Manga.schema';
import { CreateGenreDto } from './dto/CreateGenre.Schema';
import { UpdateGenreDto } from './dto/UpdateGenre.Schema';

@Injectable()
export class GenreService {
  constructor(
    @InjectModel(Genres.name) private genreModel: Model<GenresDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
  ) {}

  /**
   * Lấy danh sách tất cả genres kèm số lượng manga (storiesCount)
   */
  async getAllGenres() {
    const genres = await this.genreModel.find().sort({ name: 1 }).lean();

    const counts = await this.mangaModel.aggregate([
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
    ]);

    return genres.map((genre) => {
      const found = counts.find(
        (c) => c._id.toString() === (genre._id as Types.ObjectId).toString(),
      );
      return {
        ...genre,
        storiesCount: found ? found.count : 0,
      };
    });
  }

  /**
   * Lấy genre theo ID
   */
  async getGenreById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    const genre = await this.genreModel.findById(id);
    if (!genre) throw new NotFoundException('Genre không tồn tại');
    return genre;
  }

  /**
   * Tạo mới 1 genre
   */
  async createGenre(dto: CreateGenreDto) {
    try {
      const newGenre = new this.genreModel(dto);
      return await newGenre.save();
    } catch (e) {
      throw new BadRequestException('Không thể tạo genre (có thể bị trùng tên)');
    }
  }

  /**
   * Tạo nhiều genres 1 lúc
   */
  async createMultipleGenres(genres: CreateGenreDto[]) {
    return await this.genreModel.insertMany(genres);
  }

  /**
   * Cập nhật thông tin genre
   */
  async updateGenre(id: string, dto: UpdateGenreDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const updated = await this.genreModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException('Genre không tồn tại');
    return updated;
  }

  /**
   * Chuyển đổi trạng thái genre (active <-> inactive)
   */
  async toggleStatus(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const genre = await this.genreModel.findById(id);
    if (!genre) throw new NotFoundException('Genre không tồn tại');

    genre.status = genre.status === 'normal' ? 'hide' : 'normal';
    await genre.save();

    return genre;
  }
}
