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
  UseGuards,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { ImageChapterService } from './image-chapter.service';
import { CreateImageChapterDto } from './dto/create-image-chapter.dto';
import { UpdateImageChapterDto } from './dto/update-image-chapter.dto';
import { Types } from 'mongoose';
import * as multer from 'multer';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

const multerOptions = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB / file
  },
};

@Controller('api/image-chapter')
export class ImageChapterController {
  constructor(private readonly imageChapterService: ImageChapterService) {}

  /**
   * Public: lấy chapter theo id
   * NOTE: đặt trước :mangaId để tránh route bị nuốt
   */
  @Get('id/:id')
  async getChapterById(@Param('id') chapterId: string) {
    if (!Types.ObjectId.isValid(chapterId)) {
      throw new BadRequestException('Invalid chapterId');
    }

    const result = await this.imageChapterService.getChapterById(
      new Types.ObjectId(chapterId),
    );

    if (!result) throw new NotFoundException('Chapter not found');
    return { success: true, data: result };
  }

  /**
   * Public: lấy tất cả chapter theo mangaId
   */
  @Get(':mangaId')
  async getChaptersByManga(@Param('mangaId') mangaId: string) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const result = await this.imageChapterService.getChapterAllByManga_id(
      new Types.ObjectId(mangaId),
    );

    return { success: true, data: result };
  }

  /**
   * AUTHOR/ADMIN tạo image chapter
   */
  @Post()
  @HttpCode(201)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('images', undefined, multerOptions))
  async create(
    @Body() dto: CreateImageChapterDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parsedDto = {
      ...dto,
      price: dto.price ? Number(dto.price) : 0,
      order: dto.order ? Number(dto.order) : 1,
      is_published:
        dto.is_published === true || (dto.is_published as any) === 'true',
      is_completed:
        dto.is_completed === true || (dto.is_completed as any) === 'true',
    };

    return this.imageChapterService.createChapterWithImages(parsedDto, files);
  }

  /**
   * AUTHOR/ADMIN update image chapter
   */
  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('images', undefined, multerOptions))
  async updateChapter(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid chapterId');
    }

    let parsedDto: UpdateImageChapterDto;

    try {
      parsedDto = {
        ...body,
        price: body.price ? Number(body.price) : undefined,
        order: body.order ? Number(body.order) : undefined,
        is_published: body.is_published === 'true' || body.is_published === true,
        is_completed:
          body.is_completed === 'true' || body.is_completed === true,
        existing_images: body.existing_images
          ? JSON.parse(body.existing_images).map((img: any, index: number) => {
              if (typeof img === 'string') {
                return { url: img, order: index };
              }
              return img;
            })
          : undefined,
      };
    } catch {
      throw new BadRequestException('existing_images must be valid JSON');
    }

    const result = await this.imageChapterService.updateChapterWithImages(
      id,
      parsedDto,
      files,
    );

    return { success: true, data: result };
  }

  /**
   * AUTHOR/ADMIN xoá image chapter
   */
  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async deleteChapter(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid chapterId');
    }

    return this.imageChapterService.deleteImageChapter(new Types.ObjectId(id));
  }
}
