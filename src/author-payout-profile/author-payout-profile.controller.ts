import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Req,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import type { Request } from 'express';

import * as authorPayoutProfileService from './author-payout-profile.service';
import { CreateAuthorPayoutProfileDto } from './dto/create-profile.dto';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { Role } from 'src/common/enums/role.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { ListProfileQueryDto } from './dto/list-query.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Controller('api/payout-profile')
export class AuthorPayoutProfileController {
  constructor(private readonly authorPayoutProfileService: authorPayoutProfileService.AuthorPayoutProfileService, private readonly cloudinaryService: CloudinaryService,) { }

  @Get('me')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async getMyProfileStatus(@Req() req: Request) {
    const userId = req['user'].user_id;
    return await this.authorPayoutProfileService.getProfile(userId);
  }

  @Post('submit')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'identityImages', maxCount: 2 }],
      {
        storage: multer.memoryStorage(),
        limits: {
          fileSize: 8 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            return cb(new BadRequestException('File is not an image'), false);
          }
          cb(null, true);
        },
      },
    ),
  )
  async handleSubmit(
    @Req() req: Request,
    @Body() dto: CreateAuthorPayoutProfileDto,
    @UploadedFiles()
    files: {
      identityImages?: Express.Multer.File[];
    },
  ) {
    const userId = req['user'].user_id;

    const profileState = await this.authorPayoutProfileService.getProfile(userId);

    if (!profileState || profileState.kycStatus !== 'not_found') {
      throw new BadRequestException('Profile already exists');
    }

    const uploadedImages = await this.cloudinaryService.uploadImages(
      files.identityImages || [],
      `mangaword/payout-identity/${userId}`,
    );

    const identityImageUrls = uploadedImages.map((image) => image.secure_url);

    const payload = {
      ...dto,
      identityImages: identityImageUrls,
    };

    return await this.authorPayoutProfileService.createInitialProfile(
      userId,
      payload,
    );
  }
  @Patch('resubmit')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'identityImages', maxCount: 2 }],
      {
        storage: multer.memoryStorage(),
        limits: {
          fileSize: 8 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            return cb(new BadRequestException('File is not an image'), false);
          }
          cb(null, true);
        },
      },
    ),
  )
  async handleResubmit(
    @Req() req: Request,
    @Body() dto: CreateAuthorPayoutProfileDto,
    @Body('existingImages') existingImages: string,
    @UploadedFiles()
    files: {
      identityImages?: Express.Multer.File[];
    },
  ) {
    const userId = req['user'].user_id;

    const uploadedImages = await this.cloudinaryService.uploadImages(
      files.identityImages || [],
      `mangaword/payout-identity/${userId}`,
    );

    const newImageUrls = uploadedImages.map((image) => image.secure_url);

    let oldImages: string[] = [];

    try {
      oldImages = existingImages ? JSON.parse(existingImages) : [];
    } catch {
      oldImages = [];
    }

    const payload = {
      ...dto,
      identityImages: [...oldImages, ...newImageUrls],
    };

    return await this.authorPayoutProfileService.updateProfile(userId, payload);
  }
  @Get('list')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async GetList(@Query() query: ListProfileQueryDto) {
    return await this.authorPayoutProfileService.GetProfiles(query);
  }

  @Patch('/approve/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async approve(@Param('id') id: string, @Req() req: Request) {
    const finanicalId = req['user'].user_id;
    return await this.authorPayoutProfileService.approveProfile(id, finanicalId);
  }

  @Patch('/reject/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: Request
  ) {
    if (!reason) {
      throw new BadRequestException('You must enter reject reason');
    }
    const financialId = req['user'].user_id;
    return await this.authorPayoutProfileService.rejectProfile(id, financialId, reason);
  }
}