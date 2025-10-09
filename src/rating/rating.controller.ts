import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { RatingService } from './rating.service'
import { JwtService } from '@nestjs/jwt'
import { Types } from 'mongoose'

@Controller('api/rating')
export class RatingController {
  constructor(
    private readonly ratingService: RatingService,
    private readonly jwtService: JwtService,
  ) {}

  private getUserIdFromCookie(req: any) {
    const token = req.cookies?.access_token
    if (!token) throw new BadRequestException('Authentication required')
    const decoded = this.jwtService.verify(token)
    return new Types.ObjectId(decoded.user_id)
  }

  @Post('upsert')
  async upsert(
    @Body('mangaId') mangaIdStr: string,
    @Body('rating') rating: number,
    @Body('comment') comment: string,
    @Req() req: any,
  ) {
    const userId = this.getUserIdFromCookie(req)
    if (!mangaIdStr) throw new BadRequestException('mangaId is required')
    if (!comment) throw new BadRequestException('comment is required')
    const mangaId = new Types.ObjectId(mangaIdStr)
    const doc = await this.ratingService.upsertRating({ userId, mangaId, rating, comment })
    return { success: true, rating: doc }
  }

  @Get('mine')
  async mine(@Query('mangaId') mangaIdStr: string, @Req() req: any) {
    const userId = this.getUserIdFromCookie(req)
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


