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
    console.log('================ CREATE IMAGE CHAPTER ================')
    console.log('[START] DTO:', dto)
    console.log('[FILES COUNT]:', files?.length || 0)

    const { v4: uuidv4 } = await import('uuid')
    const { title, manga_id, price, order, is_published, is_completed } = dto

    /* -------------------------------------------------- */
    /* 1. PREPARE CHAPTER DATA                            */
    /* -------------------------------------------------- */
    const chapterOrder = order && order > 0 ? order : 1

    console.log('[1] Create chapter with:')
    console.log({
      title,
      manga_id,
      price: price ?? 0,
      order: chapterOrder,
      is_published: is_published ?? false,
    })

    /* -------------------------------------------------- */
    /* 2. CREATE CHAPTER                                  */
    /* -------------------------------------------------- */
    const chapter = await this.chapterModel.create({
      title,
      manga_id: new Types.ObjectId(manga_id),
      price: price ?? 0,
      order: chapterOrder,
      is_published: is_published ?? false,
    })

    console.log('[2] Chapter created:', chapter._id.toString())

    /* -------------------------------------------------- */
    /* 3. PREPARE IMAGE DIRECTORY                         */
    /* -------------------------------------------------- */
    const baseDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'image-chapters',
    )
    const chapterDir = path.join(baseDir, chapter._id.toString())

    if (!fs.existsSync(chapterDir)) {
      fs.mkdirSync(chapterDir, { recursive: true })
      console.log('[3] Created directory:', chapterDir)
    } else {
      console.log('[3] Directory already exists:', chapterDir)
    }

    /* -------------------------------------------------- */
    /* 4. PROCESS UPLOADED IMAGES                         */
    /* -------------------------------------------------- */
    const savedImages: string[] = []

    if (!files || files.length === 0) {
      console.log('[4] No images uploaded')
    }

    for (const file of files || []) {
      if (!file.buffer) {
        console.warn('[4] File buffer missing:', file.originalname)
        continue
      }

      try {
        const now = new Date()
        const hhmmss = now
          .toLocaleTimeString('en-GB', { hour12: false })
          .replace(/:/g, '')
        const filename = `${hhmmss}-${uuidv4()}.webp`
        const filepath = path.join(chapterDir, filename)

        console.log(
          '[4] Convert image:',
          file.originalname,
          '→',
          filename,
        )

        await sharp(file.buffer)
          .rotate()
          .webp({ quality: 80 })
          .toFile(filepath)

        savedImages.push(filename)
      } catch (err) {
        console.error('[4] Convert image failed:', file.originalname, err)
      }
    }

    console.log('[4] Saved images:', savedImages)

    /* -------------------------------------------------- */
    /* 5. CREATE / UPDATE IMAGE CHAPTER                   */
    /* -------------------------------------------------- */
    let imageChapter = await this.imageChapterModel.findOne({
      chapter_id: chapter._id,
    })

    if (imageChapter) {
      console.log('[5] ImageChapter exists → append images')

      imageChapter.images.push(...savedImages)
      imageChapter.is_completed = is_completed ?? false
      await imageChapter.save()
    } else {
      console.log('[5] ImageChapter not found → create new')

      imageChapter = await this.imageChapterModel.create({
        chapter_id: chapter._id,
        images: savedImages,
        is_completed: is_completed ?? false,
      })

      /* -------------------------------------------------- */
      /* 6. EMIT EVENT (CHAPTER CREATE COUNT)               */
      /* -------------------------------------------------- */
      const manga = await this.mangaModel
        .findById(manga_id)
        .select('authorId')

      if (manga && manga.authorId) {
        console.log(
          '[6] Emit chapter_create_count → authorId:',
          manga.authorId.toString(),
        )

        this.eventEmitter.emit('chapter_create_count', {
          userId: manga.authorId.toString(),
        })
      } else {
        console.warn(
          '[6] authorId not found for manga:',
          manga_id,
        )
      }
    }

    /* -------------------------------------------------- */
    /* 7. DONE                                            */
    /* -------------------------------------------------- */
    console.log('[DONE] Create chapter success')
    console.log('Chapter ID:', chapter._id.toString())
    console.log('Total images:', imageChapter.images.length)
    console.log('================ END CREATE IMAGE CHAPTER ================')

    return { chapter, imageChapter }
  }


  async updateChapterWithImages(
    chapterId: string,
    dto: Partial<CreateImageChapterDto> & {
      existing_images?: Array<{ url: string; order: number }>
      new_images_meta?: string | Array<{ originalname: string; order: number }>
    },
    files: Express.Multer.File[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {
    console.log('================ UPDATE IMAGE CHAPTER ================')
    console.log('[START] chapterId:', chapterId)
    console.log('[DTO]', dto)
    console.log('[FILES COUNT]', files?.length || 0)

    const { v4: uuidv4 } = await import('uuid')

    /* ---------------- PARSE META ---------------- */
    let newImagesMeta: Array<{ originalname: string; order: number }> = []

    if (dto.new_images_meta) {
      try {
        newImagesMeta = Array.isArray(dto.new_images_meta)
          ? dto.new_images_meta
          : JSON.parse(dto.new_images_meta)
      } catch {
        throw new BadRequestException('new_images_meta invalid JSON')
      }
    }

    console.log('[META] new_images_meta parsed:', newImagesMeta)

    /* ---------------- UPDATE CHAPTER ---------------- */
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

    /* ---------------- IMAGE CHAPTER ---------------- */
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

    const oldImages = imageChapter.images || []
    console.log('[DB] Old images:', oldImages)

    /* ---------------- PROCESS NEW FILES ---------------- */
    const newImagesWithOrder: { filename: string; order: number }[] = []

    if (files?.length) {
      const chapterDir = path.join(
        process.cwd(),
        'public',
        'uploads',
        'image-chapters',
        chapter._id.toString(),
      )
      fs.mkdirSync(chapterDir, { recursive: true })

      for (const file of files) {
        const meta = newImagesMeta.find(
          (m) => m.originalname === file.originalname,
        )

        if (!meta) {
          console.warn(
            '[WARN] No meta for file:',
            file.originalname,
            '→ skip',
          )
          continue
        }

        const filename = `${Date.now()}-${uuidv4()}.webp`
        const filepath = path.join(chapterDir, filename)

        console.log(
          `[NEW] ${file.originalname} → ${filename} | order=${meta.order}`,
        )

        await sharp(file.buffer)
          .rotate()
          .webp({ quality: 80 })
          .toFile(filepath)

        newImagesWithOrder.push({
          filename,
          order: meta.order,
        })
      }
    }

    console.log('[NEW] New images with order:', newImagesWithOrder)

    /* ---------------- MERGE + SORT ---------------- */
    const existing = (dto.existing_images ?? []).map((i) => ({
      filename: i.url.split('/').pop()!,
      order: i.order,
    }))

    console.log('[EXISTING] BEFORE SORT:', existing)

    const merged = [...existing, ...newImagesWithOrder]
      .sort((a, b) => a.order - b.order)
      .map((i) => i.filename)

    console.log('[FINAL] ORDERED:')
    merged.forEach((img, idx) => {
      console.log(
        `  index ${idx}: ${img} ${newImagesWithOrder.some((n) => n.filename === img)
          ? '[NEW]'
          : '[OLD]'
        }`,
      )
    })

    /* ---------------- DELETE REMOVED ---------------- */
    const imagesToDelete = oldImages.filter((img) => !merged.includes(img))
    console.log('[DELETE]', imagesToDelete)

    for (const filename of imagesToDelete) {
      const p = path.join(
        process.cwd(),
        'public',
        'uploads',
        'image-chapters',
        chapter._id.toString(),
        filename,
      )
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }

    /* ---------------- SAVE ---------------- */
    imageChapter.images = merged
    if (dto.is_completed !== undefined)
      imageChapter.is_completed = dto.is_completed

    await imageChapter.save()

    console.log('================ END UPDATE IMAGE CHAPTER ================')
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
