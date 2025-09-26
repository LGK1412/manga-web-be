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
  BadRequestException,
} from "@nestjs/common"

import { FilesInterceptor } from "@nestjs/platform-express"
import { ImageChapterService } from "./image-chapter.service"
import { CreateImageChapterDto } from "./dto/create-image-chapter.dto"
import { UpdateImageChapterDto } from "./dto/update-image-chapter.dto"
import { Types } from "mongoose"
import * as multer from "multer"

const multerOptions = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB / file
  },
}

@Controller("api/image-chapter")
export class ImageChapterController {
  constructor(private readonly imageChapterService: ImageChapterService) { }

  @Get(':mangaId')
  async getChaptersByManga(@Param('mangaId') mangaId: string) {
    const result = await this.imageChapterService.getChapterAllByManga_id(
      new Types.ObjectId(mangaId),
    );
    return { success: true, data: result };
  }

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
  @UseInterceptors(FilesInterceptor("images", undefined, multerOptions))
  async create(@Body() dto: CreateImageChapterDto, @UploadedFiles() files: Express.Multer.File[]) {
    const parsedDto = {
      ...dto,
      price: dto.price ? Number(dto.price) : 0,
      order: dto.order ? Number(dto.order) : 1,
      is_published: dto.is_published === true || (dto.is_published as any) === "true",
      is_completed: dto.is_completed === true || (dto.is_completed as any) === "true",
    }

    return this.imageChapterService.createChapterWithImages(parsedDto, files)
  }

  @Patch(":id")
  @UseInterceptors(FilesInterceptor("images", undefined, multerOptions))
  async updateChapter(@Param('id') id: string, @Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    let parsedDto: UpdateImageChapterDto

    try {
      parsedDto = {
        ...body,
        price: body.price ? Number(body.price) : undefined,
        order: body.order ? Number(body.order) : undefined,
        is_published: body.is_published === "true" || body.is_published === true,
        is_completed: body.is_completed === "true" || body.is_completed === true,
        existing_images: body.existing_images
          ? JSON.parse(body.existing_images).map((img: any, index: number) => {
            if (typeof img === "string") {
              return { url: img, order: index }
            }
            return img
          })
          : undefined,
      }
    } catch (err) {
      throw new BadRequestException("existing_images phải là JSON hợp lệ")
    }

    const result = await this.imageChapterService.updateChapterWithImages(id, parsedDto, files)
    return { success: true, data: result }
  }

  @Delete(':id')
  async deleteChapter(@Param('id') id: string) {
    return this.imageChapterService.deleteImageChapter(new Types.ObjectId(id));
  }
}
