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

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

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

  async getAllGenresPaginated(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);
    const skip = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const status = String(query.status || '').trim();
    const sortDir = query.sortDir === 'asc' ? 1 : -1;
    const sortBy = query.sortBy || 'updatedAt';

    const filter: Record<string, any> = {};
    if (search) {
      const safeSearch = this.escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const sort: Record<string, 1 | -1> =
      sortBy === 'name'
        ? { name: sortDir, _id: 1 }
        : { updatedAt: sortDir, _id: 1 };

    const [genres, total] = await Promise.all([
      this.genreModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.genreModel.countDocuments(filter),
    ]);

    const genreIds = genres.map((genre) => genre._id as Types.ObjectId);
    const counts = genreIds.length
      ? await this.mangaModel.aggregate([
          { $unwind: '$genres' },
          { $match: { genres: { $in: genreIds } } },
          { $group: { _id: '$genres', count: { $sum: 1 } } },
        ])
      : [];

    const items = genres.map((genre) => {
      const found = counts.find(
        (c) => c._id.toString() === (genre._id as Types.ObjectId).toString(),
      );
      return {
        ...genre,
        storiesCount: found ? found.count : 0,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Lấy genre theo ID
   */
  async getGenreById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID');
    }
    const genre = await this.genreModel.findById(id);
    if (!genre) throw new NotFoundException('Genre does not exist');
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
      throw new BadRequestException('Unable to create genre (possibly duplicate name)');
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
