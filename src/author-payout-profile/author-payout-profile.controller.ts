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
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { ListProfileQueryDto } from './dto/list-query.dto';

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Controller('api/payout-profile')
export class AuthorPayoutProfileController {
  constructor(private readonly authorPayoutProfileService: authorPayoutProfileService.AuthorPayoutProfileService) { }

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
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'identityImages', maxCount: 2 }
  ], {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const userId = req['user'].user_id;

        const uploadPath = `./public/payout-identity/${userId}`;

        // Tạo folder nếu chưa có
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  async handleSubmit(
    @Req() req: Request,
    @Body() dto: CreateAuthorPayoutProfileDto,
    @UploadedFiles() files: {
      identityImages?: Express.Multer.File[],
    },
  ) {
    const userId = req['user'].user_id;

    const profileState = await this.authorPayoutProfileService.getProfile(userId);
    if (!profileState || profileState.kycStatus !== 'not_found') {
      throw new BadRequestException('Profile already exists');
    }

    const payload = {
      ...dto,
      identityImages: files.identityImages?.map(f => f.filename) || [],
    };

    return await this.authorPayoutProfileService.createInitialProfile(userId, payload);
  }

  @Patch('resubmit')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'identityImages', maxCount: 2 }
  ], {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const userId = req['user'].user_id;
        const uploadPath = `./public/payout-identity/${userId}`;
        if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  async handleResubmit(
    @Req() req: Request,
    @Body() dto: CreateAuthorPayoutProfileDto,
    @Body("existingImages") existingImages: string,
    @UploadedFiles() files: { identityImages?: Express.Multer.File[] },
  ) {
    const userId = req['user'].user_id;

    const newImages = files.identityImages?.map(f => f.filename) || [];

    const oldImages = existingImages ? JSON.parse(existingImages) : [];

    const payload = {
      ...dto,
      identityImages: [...oldImages, ...newImages],
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