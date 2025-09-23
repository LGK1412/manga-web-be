import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFiles,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { ImageChapterService } from './image-chapter.service';
import { CreateImageChapterDto } from './dto/create-image-chapter.dto';
import { UpdateImageChapterDto } from './dto/update-image-chapter.dto';
import { Types } from 'mongoose';
import * as multer from 'multer';

const multerOptions = {
  storage: multer.memoryStorage(), // giữ file trong memory -> access via file.buffer
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB / file (tùy chỉnh)
  },
  // Có thể thêm fileFilter nếu muốn filter kiểu mime
};

@Controller('api/image-chapter')
export class ImageChapterController {
  constructor(private readonly imageChapterService: ImageChapterService) { }

  // Lấy tất cả chapter theo manga_id
  @Get(':mangaId')
  async getChaptersByManga(@Param('mangaId') mangaId: string) {
    const result = await this.imageChapterService.getChapterAllByManga_id(
      new Types.ObjectId(mangaId),
    );
    return { success: true, data: result };
  }

  // Lấy chi tiết 1 chapter theo id
  @Get('id/:id')
  async getChapterById(@Param('id') chapterId: string) {
    const result = await this.imageChapterService.getChapterById(
      new Types.ObjectId(chapterId),
    );
    if (!result) throw new NotFoundException('Chapter not found');
    return { success: true, data: result };
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FilesInterceptor('images', undefined, multerOptions))
  async create(
    @Body() dto: CreateImageChapterDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imageChapterService.createChapterWithImages(dto, files);
  }

  // Cập nhật chapter + images
  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', undefined, multerOptions))
  async updateChapter(
    @Param('id') id: string,
    @Body() body: any, // tạm any để parse thủ công
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let parsedDto: UpdateImageChapterDto;

    try {
      parsedDto = {
        ...body,
        price: body.price ? Number(body.price) : undefined,
        is_published: body.is_published === 'true',
        is_completed: body.is_completed === 'true',
        existing_images: body.existing_images
          ? JSON.parse(body.existing_images).map((img: any, index: number) => {
            if (typeof img === 'string') {
              return { url: img, order: index }; // tự gán order nếu chưa có
            }
            return img; // nếu đã là object thì giữ nguyên
          })
          : undefined,
      };
    } catch (err) {
      throw new BadRequestException('existing_images phải là JSON hợp lệ');
    }

    const result = await this.imageChapterService.updateChapterWithImages(
      id,
      parsedDto,
      files,
    );
    return { success: true, data: result };
  }

  // Xóa imageChapter
  @Delete(':id')
  async deleteChapter(@Param('id') id: string) {
    return this.imageChapterService.deleteImageChapter(new Types.ObjectId(id));
  }
}
