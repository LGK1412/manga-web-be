import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { RatingService } from './rating.service'
import { JwtService } from '@nestjs/jwt'
import { Types } from 'mongoose'
import { AccessTokenGuard } from 'Guards/access-token.guard'

@Controller('api/rating')
export class RatingController {
  constructor(
    private readonly ratingService: RatingService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('upsert')
  @UseGuards(AccessTokenGuard)
  async upsert(
    @Body('mangaId') mangaIdStr: string,
    @Body('rating') rating: number,
    @Body('comment') comment: string,
    @Req() req: any,
  ) {
    const payload = (req as any).user;
    const userId = new Types.ObjectId(payload.user_id)
    if (!mangaIdStr) throw new BadRequestException('mangaId is required')
    if (!comment) throw new BadRequestException('comment is required')
    const mangaId = new Types.ObjectId(mangaIdStr)
    const doc = await this.ratingService.upsertRating({ userId, mangaId, rating, comment })
    return { success: true, rating: doc }
  }

  @Get('mine')
  @UseGuards(AccessTokenGuard)
  async mine(@Query('mangaId') mangaIdStr: string, @Req() req: any) {
    const payload = (req as any).user;
    const userId = new Types.ObjectId(payload.user_id)
    if (!mangaIdStr) throw new BadRequestException('mangaId is required')
    const mangaId = new Types.ObjectId(mangaIdStr)
    const doc = await this.ratingService.getMyRating(userId, mangaId)
    return { rating: doc }
  }

  @Get('list')
  async list(
    @Query('mangaId') mangaIdStr: string,
    @Query('page') pageStr = '1',
    @Query('limit') limitStr = '6',
  ) {
    if (!mangaIdStr) throw new BadRequestException('mangaId is required')
    const mangaId = new Types.ObjectId(mangaIdStr)
    const page = Math.max(1, parseInt(pageStr as string, 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(limitStr as string, 10) || 10))
    return this.ratingService.listByManga(mangaId, page, limit)
  }

  @Get('all')
  async all(@Query('mangaId') mangaIdStr: string) {
    if (!mangaIdStr) throw new BadRequestException('mangaId is required')
    const mangaId = new Types.ObjectId(mangaIdStr)
    return this.ratingService.listAllByManga(mangaId)
  }

  
}


