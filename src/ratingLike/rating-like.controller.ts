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

import { RatingLikeService } from './rating-like.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/rating-like')
export class RatingLikeController {
  constructor(private readonly ratingLikeService: RatingLikeService) {}

  private getUserIdFromRequest(req: Request): Types.ObjectId {
    const payload = (req as any).user as JwtPayload | undefined;

    if (!payload?.userId) {
      throw new BadRequestException('Authentication required');
    }

    if (!Types.ObjectId.isValid(payload.userId)) {
      throw new BadRequestException('Invalid userId');
    }

    return new Types.ObjectId(payload.userId);
  }

  @Post('toggle')
  @UseGuards(AccessTokenGuard)
  async toggle(@Body('ratingId') ratingIdStr: string, @Req() req: Request) {
    if (!ratingIdStr) throw new BadRequestException('ratingId is required');
    if (!Types.ObjectId.isValid(ratingIdStr)) {
      throw new BadRequestException('Invalid ratingId');
    }

    const userId = this.getUserIdFromRequest(req);
    const ratingId = new Types.ObjectId(ratingIdStr);

    return this.ratingLikeService.toggleLike(ratingId, userId);
  }

  @Get('count')
  async count(@Query('ratingId') ratingIdStr: string) {
    if (!ratingIdStr) throw new BadRequestException('ratingId is required');
    if (!Types.ObjectId.isValid(ratingIdStr)) {
      throw new BadRequestException('Invalid ratingId');
    }

    const ratingId = new Types.ObjectId(ratingIdStr);
    return this.ratingLikeService.count(ratingId);
  }

  @Get('mine')
  @UseGuards(AccessTokenGuard)
  async mine(@Query('ratingId') ratingIdStr: string, @Req() req: Request) {
    if (!ratingIdStr) throw new BadRequestException('ratingId is required');
    if (!Types.ObjectId.isValid(ratingIdStr)) {
      throw new BadRequestException('Invalid ratingId');
    }

    const userId = this.getUserIdFromRequest(req);
    const ratingId = new Types.ObjectId(ratingIdStr);

    return this.ratingLikeService.mine(ratingId, userId);
  }
}
