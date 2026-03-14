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
import { AdminListProfileQueryDto } from './dto/admin-list-query.dto';

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
    @UploadedFiles() files: { identityImages?: Express.Multer.File[] },
  ) {
    const userId = req['user'].user_id;

    const payload = {
      ...dto,
      identityImages: files.identityImages?.map(f => f.filename) || [],
    };

    return await this.authorPayoutProfileService.updateProfile(userId, payload);
  }

  @Get('admin/list')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminGetList(@Query() query: AdminListProfileQueryDto) {
    return await this.authorPayoutProfileService.adminGetProfiles(query);
  }

  @Patch('admin/approve/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminApprove(@Param('id') id: string, @Req() req: Request) {
    const adminId = req['user'].user_id;
    return await this.authorPayoutProfileService.approveProfile(id, adminId);
  }

  @Patch('admin/reject/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminReject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: Request
  ) {
    if (!reason) {
      throw new BadRequestException('Lý do từ chối là bắt buộc');
    }
    const adminId = req['user'].user_id;
    return await this.authorPayoutProfileService.rejectProfile(id, adminId, reason);
  }
}