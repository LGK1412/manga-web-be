import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { type Model, Types } from "mongoose"
import { ImageChapter, type ImageChapterDocument } from "src/schemas/Image-chapter"
import { Chapter, type ChapterDocument } from "../schemas/chapter.schema"
import type { CreateImageChapterDto } from "./dto/create-image-chapter.dto"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { Manga, MangaDocument } from "src/schemas/Manga.schema"
import { CloudinaryService } from "src/cloudinary/cloudinary.service"

@Injectable()
export class ImageChapterService {
  constructor(
    @InjectModel(ImageChapter.name)
    private imageChapterModel: Model<ImageChapterDocument>,
    @InjectModel(Chapter.name)
    private chapterModel: Model<ChapterDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  private rethrowFriendlyPersistenceError(err: unknown): never {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    ) {
      throw new BadRequestException(
        'This chapter number already exists for this story.',
      )
    }
    throw err;
  }

  async getChapterAllByManga_id(manga_id: Types.ObjectId) {
    return this.chapterModel.aggregate([
      { $match: { manga_id: new Types.ObjectId(manga_id) } },
      {
        $lookup: {
          from: "imagechapters",
          localField: "_id",
          foreignField: "chapter_id",
          as: "images",
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          order: 1,
          price: 1,
          is_published: 1,
          "images._id": 1,
          "images.images": 1,
          "images.is_completed": 1,
        },
      },
      { $sort: { order: 1 } },
    ])
  }

  async getChapterById(_id: Types.ObjectId) {
    const result = await this.chapterModel.aggregate([
      { $match: { _id: new Types.ObjectId(_id) } },
      {
        $lookup: {
          from: "imagechapters",
          localField: "_id",
          foreignField: "chapter_id",
          as: "images",
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          order: 1,
          price: 1,
          is_published: 1,
          "images._id": 1,
          "images.images": 1,
          "images.is_completed": 1,
        },
      },
      { $sort: { order: 1 } },
    ])

    if (!result[0]) return null
    return result[0]
  }
  async createChapterWithImages(
    dto: CreateImageChapterDto,
    imageUrls: string[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {
    const { title, manga_id, price, order, is_published, is_completed } = dto;

    const chapterOrder = order && order > 0 ? order : 1;

    let chapter: ChapterDocument;

    try {
      chapter = await this.chapterModel.create({
        title,
        manga_id: new Types.ObjectId(manga_id),
        price: price ?? 0,
        order: chapterOrder,
        is_published: is_published ?? false,
      });
    } catch (err) {
      this.rethrowFriendlyPersistenceError(err);
    }

    let imageChapter = await this.imageChapterModel.findOne({
      chapter_id: chapter._id,
    });

    if (imageChapter) {
      imageChapter.images.push(...imageUrls);
      imageChapter.is_completed = is_completed ?? false;
      await imageChapter.save();
    } else {
      imageChapter = await this.imageChapterModel.create({
        chapter_id: chapter._id,
        images: imageUrls,
        is_completed: is_completed ?? false,
      });

      const manga = await this.mangaModel.findById(manga_id).select('authorId');

      if (manga?.authorId) {
        this.eventEmitter.emit('chapter_create_count', {
          userId: manga.authorId.toString(),
        });
      }
    }

    await this.mangaModel.findByIdAndUpdate(
      manga_id,
      { updatedAt: new Date() },
      { new: true },
    );

    return { chapter, imageChapter };
  }
  async updateChapterWithImages(
    chapterId: string,
    dto: Partial<CreateImageChapterDto> & { kept_images?: string[] },
    imageUrls: string[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {
    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.order !== undefined && dto.order > 0) updateData.order = dto.order;
    if (dto.is_published !== undefined) {
      updateData.is_published = dto.is_published;
    }

    const chapter = await this.chapterModel.findByIdAndUpdate(
      chapterId,
      updateData,
      { new: true },
    );

    if (!chapter) throw new NotFoundException('Chapter not found');

    let imageChapter = await this.imageChapterModel.findOne({
      chapter_id: chapter._id,
    });

    if (!imageChapter) {
      imageChapter = new this.imageChapterModel({
        chapter_id: chapter._id,
        images: [],
        is_completed: false,
      });
    }

    // Giữ lại ảnh cũ và sắp xếp lại
    if (dto.kept_images && Array.isArray(dto.kept_images)) {
      imageChapter.images = dto.kept_images;
    }

    // Thêm ảnh mới đã upload lên Cloudinary
    if (imageUrls && imageUrls.length > 0) {
      imageChapter.images.push(...imageUrls);
    }

    if (dto.is_completed !== undefined) {
      imageChapter.is_completed = dto.is_completed;
    }

    await imageChapter.save();

    await this.mangaModel.findByIdAndUpdate(
      chapter.manga_id,
      { updatedAt: new Date() },
      { new: true },
    );

    return { chapter, imageChapter };
  }

  async deleteImageChapter(id: Types.ObjectId): Promise<{ deletedChapter: any; deletedImageChapter: any }> {
    const imageChapter = await this.imageChapterModel.findOne({ chapter_id: id })

    if (imageChapter?.images && imageChapter?.images?.length > 0) {
      for (const imageUrl of imageChapter.images) {
        try {
          if (typeof imageUrl === "string" && /^https?:\/\//i.test(imageUrl)) {
            await this.cloudinaryService.deleteByUrl(imageUrl, "image")
          }
        } catch (err) {
          console.warn(`Không xóa được ảnh chapter từ cloudinary:`, err)
        }
      }
    }

    const deletedImageChapter = await this.imageChapterModel.deleteMany({
      chapter_id: id,
    })

    const deletedChapter = await this.chapterModel.findByIdAndDelete(id)

    // Update manga updatedAt
    if (deletedChapter?.manga_id) {
      await this.mangaModel.findByIdAndUpdate(
        deletedChapter.manga_id,
        { updatedAt: new Date() },
        { new: true },
      )
    }

    return { deletedChapter, deletedImageChapter }
  }
}
