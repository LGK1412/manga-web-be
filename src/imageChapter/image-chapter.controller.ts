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
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

export const chapterImagesInterceptor = FilesInterceptor('images', 100, {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB / ảnh
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('File không phải ảnh'), false);
    }

    cb(null, true);
  },
});

@Controller('api/image-chapter')
export class ImageChapterController {
  constructor(private readonly imageChapterService: ImageChapterService, private readonly cloudinaryService: CloudinaryService,) { }

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

  @Get(':mangaId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async getChaptersByManga(@Param('mangaId') mangaId: string) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const result = await this.imageChapterService.getChapterAllByManga_id(
      new Types.ObjectId(mangaId),
    );

    return result;
  }
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseInterceptors(chapterImagesInterceptor)
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

    const uploadedImages = await this.cloudinaryService.uploadImages(
      files,
      'mangaword/imageChapters',
    );

    const imageUrls = uploadedImages.map((image) => image.secure_url);

    return this.imageChapterService.createChapterWithImages(
      parsedDto,
      imageUrls,
    );
  }
  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UseInterceptors(chapterImagesInterceptor)
  async update(
    @Param('id') chapterId: string,
    @Body() dto: Partial<CreateImageChapterDto> & { kept_images?: string[] },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parsedDto = {
      ...dto,
      price: dto.price !== undefined ? Number(dto.price) : undefined,
      order: dto.order !== undefined ? Number(dto.order) : undefined,
      is_published:
        dto.is_published === undefined
          ? undefined
          : dto.is_published === true || (dto.is_published as any) === 'true',
      is_completed:
        dto.is_completed === undefined
          ? undefined
          : dto.is_completed === true || (dto.is_completed as any) === 'true',
    };

    const uploadedImages = await this.cloudinaryService.uploadImages(
      files,
      'mangaword/imageChapters',
    );

    const imageUrls = uploadedImages.map((image) => image.secure_url);

    return this.imageChapterService.updateChapterWithImages(
      chapterId,
      parsedDto,
      imageUrls,
    );
  }

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
