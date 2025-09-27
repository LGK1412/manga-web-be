import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Manga, MangaDocument } from '../schemas/Manga.schema';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { StylesService } from '../styles/styles.service';
import { GenreService } from '../genre/genre.service';
import { Chapter, ChapterDocument } from 'src/schemas/chapter.schema';

@Injectable()
export class MangaService {
  constructor(
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    private stylesService: StylesService,
    private genreService: GenreService,
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
  ) {}

  async createManga(createMangaDto: CreateMangaDto, authorId: Types.ObjectId) {
    try {
      // Kiểm tra styles có bị hide không
      if (createMangaDto.styles && createMangaDto.styles.length > 0) {
        for (const styleId of createMangaDto.styles) {
          const style = await this.stylesService.findById(styleId.toString());
          if (!style) {
            throw new BadRequestException(
              `Style với ID ${styleId} không tồn tại`,
            );
          }
          if (style.status === 'hide') {
            throw new BadRequestException(
              `Style "${style.name}" đã bị ẩn, không thể tạo truyện với style này`,
            );
          }
        }
      }

      // Kiểm tra genres có bị hide không
      if (createMangaDto.genres && createMangaDto.genres.length > 0) {
        for (const genreId of createMangaDto.genres) {
          const genre = await this.genreService.getGenreById(
            genreId.toString(),
          );
          if (!genre) {
            throw new BadRequestException(
              `Genre với ID ${genreId} không tồn tại`,
            );
          }
          if (genre.status === 'hide') {
            throw new BadRequestException(
              `Genre "${genre.name}" đã bị ẩn, không thể tạo truyện với genre này`,
            );
          }
        }
      }

      const newManga = new this.mangaModel({
        ...createMangaDto,
        authorId,
      });
      return await newManga.save();
    } catch (error) {
      console.error('Error creating manga:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không thể tạo manga mới');
    }
  }

  async updateManga(
    id: string,
    updateMangaDto: UpdateMangaDto,
    authorId: Types.ObjectId,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID manga không hợp lệ');
    }

    // Kiểm tra styles có bị hide không (nếu có update styles)
    if (updateMangaDto.styles && updateMangaDto.styles.length > 0) {
      for (const styleId of updateMangaDto.styles) {
        const style = await this.stylesService.findById(styleId.toString());
        if (!style) {
          throw new BadRequestException(
            `Style với ID ${styleId} không tồn tại`,
          );
        }
        if (style.status === 'hide') {
          throw new BadRequestException(
            `Style "${style.name}" đã bị ẩn, không thể cập nhật truyện với style này`,
          );
        }
      }
    }

    const result = await this.mangaModel.updateOne(
      { _id: id, authorId },
      { $set: updateMangaDto },
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'Không thể cập nhật manga hoặc manga không tồn tại',
      );
    }
    const updatedManga = await this.mangaModel
      .findById(id)
      .populate('genres', 'name')
      .populate('styles', 'name');
    return updatedManga;
  }

  async deleteManga(id: string, authorId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID manga không hợp lệ');
    }

    const result = await this.mangaModel.deleteOne({ _id: id, authorId });

    if (result.deletedCount === 0) {
      throw new BadRequestException(
        'Không thể xóa manga hoặc manga không tồn tại',
      );
    }

    return { success: true, message: 'Xóa manga thành công' };
  }

  async getAllMangasByAuthor(authorId: Types.ObjectId) {
    const mangas = await this.mangaModel
      .find({ authorId })
      .populate('genres', 'name')
      .populate('styles', 'name')
      .sort({ createdAt: -1 });

    if (!mangas || mangas.length === 0) {
      return [];
    }

    return mangas;
  }

  async toggleDelete(id: string, authorId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID manga không hợp lệ');
    }

    const manga = await this.mangaModel.findOne({ _id: id, authorId });
    if (!manga) {
      throw new BadRequestException(
        'Manga không tồn tại hoặc không thuộc quyền sở hữu',
      );
    }

    const nextDeleted = !Boolean((manga as any).isDeleted);
    await this.mangaModel.updateOne(
      { _id: id, authorId },
      { $set: { isDeleted: nextDeleted } },
    );

    const updated = await this.mangaModel
      .findById(id)
      .populate('genres', 'name')
      .populate('styles', 'name');
    return updated;
  }
  async getAllManga(page = 1, limit = 24) {
    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      isPublish: true,
    };

    const pipeline: any[] = [
      { $match: matchStage },

      // Chapters public gần nhất (đổi field cho đúng schema của bạn)
      {
        $lookup: {
          from: 'chapters',
          let: { mangaId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$mangaId', '$$mangaId'] }, // đổi thành '$manga_id' nếu schema snake_case
                    { $ne: ['$isDeleted', true] },
                    { $eq: ['$isPublished', true] }, // đổi thành '$is_published'
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $project: { _id: 1, title: 1, order: 1, createdAt: 1 } },
          ],
          as: '_chapters',
        },
      },

      // Styles (manga.styles là mảng ObjectId)
      {
        $lookup: {
          from: 'styles',
          localField: 'styles',
          foreignField: '_id',
          as: 'styles',
        },
      },

      // Genres (manga.genres là mảng ObjectId)
      {
        $lookup: {
          from: 'genres',
          localField: 'genres',
          foreignField: '_id',
          as: 'genres',
        },
      },

      // Ratings (nếu có)
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'storyId', // đổi thành 'story_id' nếu schema snake_case
          as: 'ratings',
        },
      },

      // Tổng hợp field chuẩn
      {
        $addFields: {
          chapters_count: { $size: '$_chapters' },
          latest_chapter: { $arrayElemAt: ['$_chapters', 0] },
          rating_avg: { $avg: '$ratings.rating' },
          styles: {
            $map: {
              input: '$styles',
              as: 's',
              in: { _id: '$$s._id', name: '$$s.name' },
            },
          },
          genres: {
            $map: {
              input: '$genres',
              as: 'g',
              in: { _id: '$$g._id', name: '$$g.name' },
            },
          },
        },
      },

      // Chọn field trả về
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          authorId: 1,
          summary: 1,
          coverImage: 1, // <- frontend sẽ map coverImage thành coverUrl
          isPublish: 1,
          status: 1,
          views: 1,
          follows: 1,
          createdAt: 1,
          updatedAt: 1,

          styles: 1,
          genres: 1,

          rating_avg: { $ifNull: ['$rating_avg', 0] },
          chapters_count: 1,
          'latest_chapter.title': 1,
          'latest_chapter.order': 1,
          'latest_chapter.createdAt': 1,
        },
      },

      // Sắp xếp mới cập nhật (client vẫn có thể sort lại view/follow local)
      { $sort: { updatedAt: -1 } },

      // Phân trang + total trong 1 lần query
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const [res] = await this.mangaModel
      .aggregate(pipeline)
      .allowDiskUse(true)
      .exec();
    return { data: res?.data ?? [], total: res?.total ?? 0 };
  }

  async findMangaDetail(mangaId: string) {
    // Kiểm tra id hợp lệ
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new NotFoundException('Manga not found');
    }

    // Tìm manga + populate author
    const manga = await this.mangaModel
      .findById(mangaId)
      .populate('authorId', 'username avatar') // lấy thông tin tác giả
      .lean();

    if (!manga) {
      throw new NotFoundException('Manga not found');
    }

    // Lấy danh sách chapter đã publish, sắp xếp theo order tăng dần
    const chapters = await this.chapterModel
      .find({
        manga_id: new Types.ObjectId(mangaId),
        is_published: true,
      })
      .sort({ order: 1 })
      .select('_id title order') // chỉ lấy các trường cần cho FE
      .lean();

    // Trả về dữ liệu gộp
    return {
      _id: manga._id,
      title: manga.title,
      summary: manga.summary,
      coverImage: manga.coverImage,
      author: manga.authorId,
      views: manga.views,
      status: manga.status,
      chapters,
    };
  }
}
