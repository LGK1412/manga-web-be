import { Injectable, NotFoundException } from "@nestjs/common"
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
    const { v4: uuidv4 } = await import("uuid")
    const { title, manga_id, price, order, is_published, is_completed } = dto

    const chapterOrder = order && order > 0 ? order : 1

    const chapter = await this.chapterModel.create({
      title,
      manga_id: new Types.ObjectId(manga_id),
      price: price ?? 0,
      order: chapterOrder,
      is_published: is_published ?? false,
    })

    const baseDir = path.join(process.cwd(), "public", "uploads", "image-chapters")
    const chapterDir = path.join(baseDir, chapter._id.toString())
    if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true })

    const savedImages: string[] = []

    for (const file of files) {
      try {
        if (!file.buffer) {
          console.warn("File buffer không tồn tại:", file.originalname)
          continue
        }

        const now = new Date()
        const hhmmss = now.toLocaleTimeString("en-GB", { hour12: false }).replace(/:/g, "")
        const filename = `${hhmmss}-${uuidv4()}.webp`
        const filepath = path.join(chapterDir, filename)

        await sharp(file.buffer).rotate().webp({ quality: 80 }).toFile(filepath)
        savedImages.push(filename)
      } catch (err) {
        console.error("Lỗi convert ảnh:", file.originalname, err)
      }
    }

    let imageChapter = await this.imageChapterModel.findOne({ chapter_id: chapter._id })
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

      // Emit
      const manga = await this.mangaModel.findById(manga_id).select("authorId");
      if (manga && manga.authorId) {
        this.eventEmitter.emit("chapter_create_count", { userId: manga.authorId.toString() });
      } else {
        console.warn("Không tìm thấy authorId cho manga:", manga_id);
      }
    }

    return { chapter, imageChapter }
  }

  async updateChapterWithImages(
    chapterId: string,
    dto: Partial<CreateImageChapterDto> & { existing_images?: Array<{ url: string; order: number }> },
    files: Express.Multer.File[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {
    const { v4: uuidv4 } = await import("uuid")
    const { title, price, order, is_published, is_completed, existing_images } = dto

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (price !== undefined) updateData.price = price
    if (order !== undefined && order > 0) updateData.order = order
    if (is_published !== undefined) updateData.is_published = is_published

    const chapter = await this.chapterModel.findByIdAndUpdate(chapterId, updateData, { new: true })
    if (!chapter) throw new NotFoundException("Chapter not found")

    let imageChapter = await this.imageChapterModel.findOne({ chapter_id: chapter._id })
    if (!imageChapter) {
      imageChapter = new this.imageChapterModel({
        chapter_id: chapter._id,
        images: [],
        is_completed: false,
      })
    }

    const oldImages = imageChapter.images || []
    const newImages: string[] = []

    if (files && files.length > 0) {
      const baseDir = path.join(process.cwd(), "public", "uploads", "image-chapters")
      const chapterDir = path.join(baseDir, chapter._id.toString())
      if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true })

      for (const file of files) {
        if (!file.buffer) continue
        try {
          const now = new Date()
          const hhmmss = now.toLocaleTimeString("en-GB", { hour12: false }).replace(/:/g, "")
          const filename = `${hhmmss}-${uuidv4()}.webp`
          const filepath = path.join(chapterDir, filename)

          await sharp(file.buffer).rotate().webp({ quality: 80 }).toFile(filepath)
          newImages.push(filename)
        } catch (err) {
          console.error("Lỗi convert ảnh:", file.originalname, err)
        }
      }
    }

    let finalImages: string[] = []

    if (Array.isArray(existing_images) && existing_images.length > 0) {
      const sortedExistingImages = existing_images
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const urlParts = item.url.split("/")
          return urlParts[urlParts.length - 1]
        })

      finalImages.push(...sortedExistingImages)
      finalImages.push(...newImages)
    } else {
      finalImages = [...newImages]
    }

    const imagesToKeep = finalImages.filter((img) => oldImages.includes(img))
    const imagesToDelete = oldImages.filter((img) => !finalImages.includes(img))

    for (const filename of imagesToDelete) {
      try {
        const filePath = path.join(
          process.cwd(),
          "public",
          "uploads",
          "image-chapters",
          chapter._id.toString(),
          filename,
        )
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log(`Đã xóa file: ${filePath}`)
        }
      } catch (err) {
        console.warn(`Không xóa được file ${filename}:`, err)
      }
    }

    imageChapter.images = finalImages
    if (is_completed !== undefined) imageChapter.is_completed = is_completed

    await imageChapter.save()

    console.log(`Updated chapter ${chapterId}:`)
    console.log(`- Old images: ${oldImages.length}`)
    console.log(`- New images: ${newImages.length}`)
    console.log(`- Final images: ${finalImages.length}`)
    console.log(`- Kept images: ${imagesToKeep.length}`)
    console.log(`- Deleted images: ${imagesToDelete.length}`)

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

    return { deletedChapter, deletedImageChapter }
  }
}
