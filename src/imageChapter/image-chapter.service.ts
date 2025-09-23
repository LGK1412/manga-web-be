import {
  Injectable,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ImageChapter, ImageChapterDocument } from 'src/schemas/Image-chapter';
import { Chapter, ChapterDocument } from '../schemas/chapter.schema';
import { CreateImageChapterDto } from './dto/create-image-chapter.dto';

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class ImageChapterService {
  constructor(
    @InjectModel(ImageChapter.name)
    private imageChapterModel: Model<ImageChapter>,
    @InjectModel(Chapter.name)
    private chapterModel: Model<ChapterDocument>,
  ) { }

  async getChapterAllByManga_id(manga_id: Types.ObjectId) {
    return this.chapterModel.aggregate([
      { $match: { manga_id: new Types.ObjectId(manga_id) } },
      {
        $lookup: {
          from: 'imagechapters', // tên collection trong Mongo
          localField: '_id',
          foreignField: 'chapter_id',
          as: 'images',
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          order: 1,
          price: 1,
          is_published: 1,
          'images._id': 1,
          'images.images': 1, // array ảnh
          'images.is_completed': 1,
        },
      },
      { $sort: { order: 1 } },
    ]);
  }

  async getChapterById(_id: Types.ObjectId) {
    const result = await this.chapterModel.aggregate([
      { $match: { _id: new Types.ObjectId(_id) } },
      {
        $lookup: {
          from: 'imagechapters',
          localField: '_id',
          foreignField: 'chapter_id',
          as: 'images',
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          order: 1,
          price: 1,
          is_published: 1,
          'images._id': 1,
          'images.images': 1,
          'images.is_completed': 1,
        },
      },
      { $sort: { order: 1 } },
    ]);

    if (!result[0]) return null;

    const chapter = result[0];
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3333';

    if (chapter.images?.length > 0) {
      chapter.images = chapter.images.map((imgDoc: any) => ({
        ...imgDoc,
        images: Array.isArray(imgDoc.images)
          ? imgDoc.images.map((p: string) =>
            `${backendUrl}${p.startsWith('/') ? p : `/${p}`}`
          )
          : [],
      }));
    }

    return chapter;
  }

  async createChapterWithImages(
    dto: CreateImageChapterDto,
    files: Express.Multer.File[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {
    const { v4: uuidv4 } = await import('uuid');
    const { title, manga_id, price, order, is_published, is_completed } = dto;

    // Tạo chapter trước
    const chapter = await this.chapterModel.create({
      title,
      manga_id: new Types.ObjectId(manga_id),
      price: price ?? 0,
      order: order ?? 1,
      is_published: is_published ?? false,
    });

    // Nếu không có file thì chỉ tạo document rỗng
    // if (!files || files.length === 0) {
    //   const imageChapter = await this.imageChapterModel.create({
    //     chapter_id: chapter._id,
    //     is_completed: is_completed ?? false,
    //   });
    //   return { chapter, imageChapter };
    // }

    // Tạo folder theo chapter_id
    const baseDir = path.join(process.cwd(), 'public', 'uploads', 'image-chapters');
    const chapterDir = path.join(baseDir, chapter._id.toString());
    if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

    const savedImages: string[] = [];

    for (const file of files) {
      try {
        if (!file.buffer) {
          console.warn('File buffer không tồn tại:', file.originalname);
          continue;
        }

        // Đặt tên ảnh theo giờ-phút-giây + uuid
        const now = new Date();
        const hhmmss = now
          .toLocaleTimeString('en-GB', { hour12: false }) // "14:23:45"
          .replace(/:/g, ''); // -> "142345"
        const filename = `${hhmmss}-${uuidv4()}.webp`;
        const filepath = path.join(chapterDir, filename);

        await sharp(file.buffer)
          .rotate()
          .webp({ quality: 80 })
          .toFile(filepath);

        // URL trả về phải kèm folder con
        savedImages.push(`/uploads/image-chapters/${chapter._id}/${filename}`);
      } catch (err) {
        console.error('Lỗi convert ảnh:', file.originalname, err);
      }
    }

    // Tạo / update imageChapter
    let imageChapter = await this.imageChapterModel.findOne({ chapter_id: chapter._id });
    if (imageChapter) {
      imageChapter.images.push(...savedImages);
      imageChapter.is_completed = is_completed ?? false;
      await imageChapter.save();
    } else {
      imageChapter = await this.imageChapterModel.create({
        chapter_id: chapter._id,
        images: savedImages,
        is_completed: is_completed ?? false,
      });
    }

    return { chapter, imageChapter };
  }

  async updateChapterWithImages(
    chapterId: string,
    dto: Partial<CreateImageChapterDto> & { existing_images?: Array<{ url: string, order: number }> },
    files: Express.Multer.File[],
  ): Promise<{ chapter: ChapterDocument; imageChapter: ImageChapterDocument }> {
    const { v4: uuidv4 } = await import('uuid');
    const { title, price, order, is_published, is_completed, existing_images } = dto;

    // 1️⃣ Cập nhật thông tin chapter
    const chapter = await this.chapterModel.findByIdAndUpdate(
      chapterId,
      {
        ...(title && { title }),
        ...(price !== undefined && { price }),
        ...(order !== undefined && { order }),
        ...(is_published !== undefined && { is_published }),
      },
      { new: true },
    );
    if (!chapter) throw new NotFoundException('Chapter not found');

    // 2️⃣ Lấy imageChapter hiện tại hoặc tạo mới
    let imageChapter = await this.imageChapterModel.findOne({ chapter_id: chapter._id });
    if (!imageChapter) {
      imageChapter = new this.imageChapterModel({
        chapter_id: chapter._id,
        images: [],
        is_completed: false,
      });
    }

    const oldImages = imageChapter.images || [];

    // 3️⃣ Xử lý ảnh mới (upload files)
    const newImages: string[] = [];
    if (files && files.length > 0) {
      const baseDir = path.join(process.cwd(), 'public', 'uploads', 'image-chapters');
      const chapterDir = path.join(baseDir, chapter._id.toString());
      if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

      for (const file of files) {
        if (!file.buffer) continue;
        try {
          const now = new Date();
          const hhmmss = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '');
          const filename = `${hhmmss}-${uuidv4()}.webp`;
          const filepath = path.join(chapterDir, filename);

          await sharp(file.buffer).rotate().webp({ quality: 80 }).toFile(filepath);
          newImages.push(`/uploads/image-chapters/${chapter._id}/${filename}`);
        } catch (err) {
          console.error('Lỗi convert ảnh:', file.originalname, err);
        }
      }
    }

    // 4️⃣ Tạo danh sách ảnh cuối cùng theo thứ tự từ frontend
    let finalImages: string[] = [];

    if (Array.isArray(existing_images) && existing_images.length > 0) {
      // Frontend gửi danh sách ảnh với thứ tự cụ thể
      // Sắp xếp existing_images theo order trước
      const sortedExistingImages = existing_images
        .sort((a, b) => a.order - b.order)
        .map(item => {
          // Chuyển đổi từ full URL về relative path nếu cần
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:3333';
          return item.url.replace(backendUrl, '');
        });

      // Thêm ảnh existing theo thứ tự
      finalImages.push(...sortedExistingImages);

      // Thêm ảnh mới vào cuối (hoặc vào vị trí cụ thể nếu frontend chỉ định)
      finalImages.push(...newImages);
    } else {
      // Trường hợp không có existing_images được gửi lên
      // Nếu là trường hợp này, có nghĩa là user muốn xóa tất cả ảnh cũ
      finalImages = [...newImages];
    }

    // 5️⃣ Xác định ảnh cần xóa (những ảnh cũ không còn trong finalImages)
    const imagesToKeep = finalImages.filter(img => oldImages.includes(img));
    const imagesToDelete = oldImages.filter(img => !finalImages.includes(img));

    // Xóa file vật lý của những ảnh bị loại bỏ
    for (const imgPath of imagesToDelete) {
      try {
        const filePath = path.join(process.cwd(), 'public', imgPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Đã xóa file: ${filePath}`);
        }
      } catch (err) {
        console.warn(`Không xóa được file ${imgPath}:`, err);
      }
    }

    // 6️⃣ Cập nhật danh sách ảnh trong database
    imageChapter.images = finalImages;
    if (is_completed !== undefined) imageChapter.is_completed = is_completed;

    await imageChapter.save();

    console.log(`Updated chapter ${chapterId}:`);
    console.log(`- Old images: ${oldImages.length}`);
    console.log(`- New images: ${newImages.length}`);
    console.log(`- Final images: ${finalImages.length}`);
    console.log(`- Kept images: ${imagesToKeep.length}`);
    console.log(`- Deleted images: ${imagesToDelete.length}`);

    return { chapter, imageChapter };
  }

  async deleteImageChapter(
    id: Types.ObjectId,
  ): Promise<{ deletedChapter: any; deletedImageChapter: any }> {
    // Lấy thông tin imageChapter trước khi xóa để xóa files
    const imageChapter = await this.imageChapterModel.findOne({ chapter_id: id });

    // Xóa tất cả files ảnh
    if (imageChapter?.images && imageChapter?.images?.length > 0) {
      for (const imgPath of imageChapter.images) {
        try {
          const filePath = path.join(process.cwd(), 'public', imgPath);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
          console.warn(`Không xóa được file ${imgPath}:`, err);
        }
      }

      // Xóa folder chương nếu rỗng
      try {
        const chapterDir = path.join(process.cwd(), 'public', 'uploads', 'image-chapters', id.toString());
        if (fs.existsSync(chapterDir)) {
          const files = fs.readdirSync(chapterDir);
          if (files.length === 0) {
            fs.rmdirSync(chapterDir);
          }
        }
      } catch (err) {
        console.warn(`Không xóa được folder chương:`, err);
      }
    }

    // Xoá imageChapter trước
    const deletedImageChapter = await this.imageChapterModel.deleteMany({
      chapter_id: id,
    });

    // Xoá chapter
    const deletedChapter = await this.chapterModel.findByIdAndDelete(id);

    return { deletedChapter, deletedImageChapter };
  }
}