import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { RatingLikeService } from './rating-like.service'
import { JwtService } from '@nestjs/jwt'
import { Types } from 'mongoose'

@Controller('api/rating-like')
export class RatingLikeController {
  constructor(
    private readonly ratingLikeService: RatingLikeService,
    private readonly jwtService: JwtService,
  ) {}

  private getUserIdFromCookie(req: any) {
    const token = req.cookies?.access_token
    if (!token) throw new BadRequestException('Authentication required')
    const decoded = this.jwtService.verify(token)
    return new Types.ObjectId(decoded.user_id)
  }

  @Post('toggle')
  async toggle(@Body('ratingId') ratingIdStr: string, @Req() req: any) {
    if (!ratingIdStr) throw new BadRequestException('ratingId is required')
    const userId = this.getUserIdFromCookie(req)
    const ratingId = new Types.ObjectId(ratingIdStr)
    return this.ratingLikeService.toggleLike(ratingId, userId)
  }

  @Get('count')
  async count(@Query('ratingId') ratingIdStr: string) {
    if (!ratingIdStr) throw new BadRequestException('ratingId is required')
    const ratingId = new Types.ObjectId(ratingIdStr)
    return this.ratingLikeService.count(ratingId)
  }

  @Get('mine')
  async mine(@Query('ratingId') ratingIdStr: string, @Req() req: any) {
    if (!ratingIdStr) throw new BadRequestException('ratingId is required')
    const userId = this.getUserIdFromCookie(req)
    const ratingId = new Types.ObjectId(ratingIdStr)
    return this.ratingLikeService.mine(ratingId, userId)
  }
}


