import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Query,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { LicenseService } from './license.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

import { UploadLicenseDto } from './dto/upload-license.dto';
import { ReviewLicenseDto } from './dto/review-license.dto';
import { UpdateStoryRightsDto } from './dto/update-story-rights.dto';
import { AcceptRightsDeclarationDto } from './dto/accept-rights-declaration.dto';
import { licenseFilesInterceptor } from './constants/license-upload.interceptor';

@Controller('api/license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post(':mangaId/files')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @UseInterceptors(licenseFilesInterceptor)
  async uploadLicense(
    @Param('mangaId') mangaId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadLicenseDto,
    @Req() req: Request,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Missing license files');
    }

    const user = (req as any).user;
    const userId = user?.user_id || user?.userId;

    return this.licenseService.uploadLicenseForManga(
      mangaId,
      userId,
      files,
      dto.note,
    );
  }

  @Get(':mangaId/status')
  @UseGuards(AccessTokenGuard)
  async getLicenseStatus(@Param('mangaId') mangaId: string) {
    return this.licenseService.getLicenseStatus(mangaId);
  }

  @Get(':mangaId/rights')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  async getStoryRights(@Param('mangaId') mangaId: string, @Req() req: Request) {
    const user = (req as any).user as JwtPayload;
    const actorId = (user as any)?.user_id || (user as any)?.userId;
    const actorRole = (user as any)?.role;

    return this.licenseService.getStoryRights(mangaId, actorId, actorRole);
  }

  @Patch(':mangaId/rights')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateStoryRights(
    @Param('mangaId') mangaId: string,
    @Body() dto: UpdateStoryRightsDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtPayload;
    const actorId = (user as any)?.user_id || (user as any)?.userId;
    const actorRole = (user as any)?.role;

    return this.licenseService.updateStoryRights(
      mangaId,
      actorId,
      dto,
      actorRole,
    );
  }

  @Patch(':mangaId/rights/declaration')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async acceptRightsDeclaration(
    @Param('mangaId') mangaId: string,
    @Body() dto: AcceptRightsDeclarationDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtPayload;
    const actorId = (user as any)?.user_id || (user as any)?.userId;
    const actorRole = (user as any)?.role;

    return this.licenseService.acceptRightsDeclaration(
      mangaId,
      actorId,
      dto,
      actorRole,
    );
  }

  @Get('queue')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  async getLicenseQueue(
    @Query('status')
    status: 'all' | 'none' | 'pending' | 'approved' | 'rejected' = 'pending',
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    return this.licenseService.getLicenseQueue(status, q, p, l);
  }

  @Get('pending')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  async getPendingLicenses() {
    const res = await this.licenseService.getLicenseQueue('pending', '', 1, 50);
    return res.data;
  }

  @Get(':mangaId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  async getLicenseDetail(@Param('mangaId') mangaId: string) {
    return this.licenseService.getLicenseDetail(mangaId);
  }

  @Patch(':mangaId/review')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async reviewLicense(
    @Param('mangaId') mangaId: string,
    @Body() dto: ReviewLicenseDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const reviewerId = user?.user_id || user?.userId;

    return this.licenseService.reviewLicense(
      mangaId,
      reviewerId,
      dto.status,
      dto.rejectReason,
      dto.publishAfterApprove ?? false,
    );
  }
}
