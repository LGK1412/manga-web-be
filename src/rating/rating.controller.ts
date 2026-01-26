import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';

import { RatingService } from './rating.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  private getUserObjectId(req: Request): Types.ObjectId {
    const payload = (req as any).user as JwtPayload | undefined;

    if (!payload?.userId) {
      throw new BadRequestException('Authentication required');
    }

    if (!Types.ObjectId.isValid(payload.userId)) {
      throw new BadRequestException('Invalid userId');
    }

    return new Types.ObjectId(payload.userId);
  }

  @Post('upsert')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async upsert(
    @Body('mangaId') mangaIdStr: string,
    @Body('rating') rating: number,
    @Body('comment') comment: string,
    @Req() req: Request,
  ) {
    if (!mangaIdStr) throw new BadRequestException('mangaId is required');
    if (!Types.ObjectId.isValid(mangaIdStr)) {
      throw new BadRequestException('Invalid mangaId');
    }
    if (rating === undefined || rating === null) {
      throw new BadRequestException('rating is required');
    }
    if (!comment) throw new BadRequestException('comment is required');

    const userId = this.getUserObjectId(req);
    const mangaId = new Types.ObjectId(mangaIdStr);

    const doc = await this.ratingService.upsertRating({
      userId,
      mangaId,
      rating,
      comment,
    });

    return { success: true, rating: doc };
  }

  @Get('mine')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async mine(@Query('mangaId') mangaIdStr: string, @Req() req: Request) {
    if (!mangaIdStr) throw new BadRequestException('mangaId is required');
    if (!Types.ObjectId.isValid(mangaIdStr)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const userId = this.getUserObjectId(req);
    const mangaId = new Types.ObjectId(mangaIdStr);

    const doc = await this.ratingService.getMyRating(userId, mangaId);
    return { rating: doc };
  }

  @Get('list')
  async list(
    @Query('mangaId') mangaIdStr: string,
    @Query('page') pageStr = '1',
    @Query('limit') limitStr = '6',
  ) {
    if (!mangaIdStr) throw new BadRequestException('mangaId is required');
    if (!Types.ObjectId.isValid(mangaIdStr)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const mangaId = new Types.ObjectId(mangaIdStr);
    const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(limitStr as string, 10) || 10),
    );

    return this.ratingService.listByManga(mangaId, page, limit);
  }

  @Get('all')
  async all(@Query('mangaId') mangaIdStr: string) {
    if (!mangaIdStr) throw new BadRequestException('mangaId is required');
    if (!Types.ObjectId.isValid(mangaIdStr)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const mangaId = new Types.ObjectId(mangaIdStr);
    return this.ratingService.listAllByManga(mangaId);
  }
}
