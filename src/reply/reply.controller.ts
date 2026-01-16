import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { ReplyService } from './reply.service';
import { CreateReplyChapterDTO } from './dto/createReplyChapterdto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { OptionalAccessTokenGuard } from 'src/common/guards/optional-access-token.guard';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('/api/reply')
export class ReplyController {
  constructor(private readonly replyService: ReplyService) {}

  @Post('/create-reply-chapter')
  @UseGuards(AccessTokenGuard)
  async createCommentChapter(
    @Body() createReplyChaperDto: CreateReplyChapterDTO,
    @Req() req: Request,
  ) {
    const payload = (req as any).user as JwtPayload;
    const result = await this.replyService.createReplyChapter(
      createReplyChaperDto,
      payload,
    );

    return { success: true, result };
  }

  @Post('/upvote')
  @UseGuards(AccessTokenGuard)
  async upVote(@Body('reply_id') reply_id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.replyService.upVote(reply_id, payload);
  }

  @Post('/downvote')
  @UseGuards(AccessTokenGuard)
  async downVote(@Body('reply_id') reply_id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.replyService.downVote(reply_id, payload);
  }

  /**
   * Public endpoint: ai cũng xem được reply
   * Nếu có token hợp lệ => req.user có payload để service biết user đã vote chưa, v.v.
   */
  @Get('/:id')
  @UseGuards(OptionalAccessTokenGuard)
  async getALlRepliesOfCommentChapter(@Param('id') id: string, @Req() req: Request) {
    const payload = ((req as any).user ?? null) as JwtPayload | null;
    return this.replyService.getRepliesForCommentChapter(id, payload);
  }
}
