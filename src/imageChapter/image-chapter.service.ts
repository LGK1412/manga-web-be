import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { type Model, Types } from "mongoose"
import { ImageChapter, type ImageChapterDocument } from "src/schemas/Image-chapter"
import { Chapter, type ChapterDocument } from "../schemas/chapter.schema"
import type { CreateImageChapterDto } from "./dto/create-image-chapter.dto"
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { Manga, MangaDocument } from "src/schemas/Manga.schema"

@Injectable()
export class ImageChapterService {
  constructor(
    @InjectModel(ImageChapter.name)
    private imageChapterModel: Model<ImageChapterDocument>,
    @InjectModel(Chapter.name)
    private chapterModel: Model<ChapterDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    private readonly eventEmitter: EventEmitter2,
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

  private async saveImagesAsWebp(
    chapterId: string,
    files: Express.Multer.File[],
  ): Promise<string[]> {
    const { v4: uuidv4 } = await import('uuid')

    const chapterDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'image-chapters',
      chapterId,
    )

    fs.mkdirSync(chapterDir, { recursive: true })

    const savedImages: string[] = []

    try {
      for (const file of files || []) {
        const filename = `${Date.now()}-${uuidv4()}.webp`
        const filepath = path.join(chapterDir, filename)

        await sharp(file.buffer)
          .rotate()
          .webp({ quality: 80, effort: 4 })
          .toFile(filepath)

        savedImages.push(filename)
      }

      return savedImages
    } catch (error) {
      throw new BadRequestException('Image processing failed')
    }
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
    files: Express.Multer.File[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {

    const { title, manga_id, price, order, is_published, is_completed } = dto

    const chapterOrder = order && order > 0 ? order : 1

    let chapter: ChapterDocument

    try {
      chapter = await this.chapterModel.create({
        title,
        manga_id: new Types.ObjectId(manga_id),
        price: price ?? 0,
        order: chapterOrder,
        is_published: is_published ?? false,
      })
    } catch (err) {
      this.rethrowFriendlyPersistenceError(err)
    }

    const savedImages = await this.saveImagesAsWebp(
      chapter._id.toString(),
      files,
    )

    let imageChapter = await this.imageChapterModel.findOne({
      chapter_id: chapter._id,
    })

    if (imageChapter) {
      imageChapter.images.push(...savedImages)
      imageChapter.is_completed = is_completed ?? false
      await imageChapter.save()
    } else {
      imageChapter = await this.imageChapterModel.create({
        chapter_id: chapter._id,
        images: savedImages,
        is_completed: is_completed ?? false,
      })

      const manga = await this.mangaModel
        .findById(manga_id)
        .select('authorId')

      if (manga?.authorId) {
        this.eventEmitter.emit('chapter_create_count', {
          userId: manga.authorId.toString(),
        })
      }
    }

    // Update manga updatedAt
    await this.mangaModel.findByIdAndUpdate(
      manga_id,
      { updatedAt: new Date() },
      { new: true },
    )

    return { chapter, imageChapter }
  }

  async updateChapterWithImages(
    chapterId: string,
    dto: Partial<CreateImageChapterDto> & { kept_images?: string[] },
    files: Express.Multer.File[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {

    const updateData: any = {}

    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.price !== undefined) updateData.price = dto.price
    if (dto.order !== undefined && dto.order > 0) updateData.order = dto.order
    if (dto.is_published !== undefined)
      updateData.is_published = dto.is_published

    const chapter = await this.chapterModel.findByIdAndUpdate(
      chapterId,
      updateData,
      { new: true },
    )

    if (!chapter) throw new NotFoundException('Chapter not found')

    let imageChapter = await this.imageChapterModel.findOne({
      chapter_id: chapter._id,
    })

    if (!imageChapter) {
      imageChapter = new this.imageChapterModel({
        chapter_id: chapter._id,
        images: [],
        is_completed: false,
      })
    }

    // Handle kept_images array (for deletion + reordering)
    if (dto.kept_images && Array.isArray(dto.kept_images)) {
      const keptSet = new Set(dto.kept_images)
      const imagesToDelete = imageChapter.images.filter(
        (img) => !keptSet.has(img)
      )

      // Delete removed images from filesystem
      const chapterDir = path.join(
        process.cwd(),
        'public',
        'uploads',
        'image-chapters',
        chapter._id.toString(),
      )

      for (const filename of imagesToDelete) {
        try {
          const filePath = path.join(chapterDir, filename)
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch (err) {
          console.warn(`Could not delete file ${filename}:`, err)
        }
      }

      // Reorder kept images
      imageChapter.images = dto.kept_images
    }

    // Save new images
    if (files && files.length > 0) {
      const savedImages = await this.saveImagesAsWebp(
        chapter._id.toString(),
        files,
      )
      imageChapter.images.push(...savedImages)
    }

    if (dto.is_completed !== undefined)
      imageChapter.is_completed = dto.is_completed

    await imageChapter.save()

    // Update manga updatedAt
    await this.mangaModel.findByIdAndUpdate(
      chapter.manga_id,
      { updatedAt: new Date() },
      { new: true },
    )

    return { chapter, imageChapter }
  }

  async deleteImageChapter(id: Types.ObjectId): Promise<{ deletedChapter: any; deletedImageChapter: any }> {
    const imageChapter = await this.imageChapterModel.findOne({ chapter_id: id })

    if (imageChapter?.images && imageChapter?.images?.length > 0) {
      for (const filename of imageChapter.images) {
        try {
          const filePath = path.join(process.cwd(), "public", "uploads", "image-chapters", id.toString(), filename)
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch (err) {
          console.warn(`Không xóa được file ${filename}:`, err)
        }
      }

      try {
        const chapterDir = path.join(process.cwd(), "public", "uploads", "image-chapters", id.toString())
        if (fs.existsSync(chapterDir)) {
          const files = fs.readdirSync(chapterDir)
          if (files.length === 0) {
            fs.rmdirSync(chapterDir)
          }
        }
      } catch (err) {
        console.warn(`Không xóa được folder chương:`, err)
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
