import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { ReplyService } from './reply.service';
import { CreateReplyChapterDTO } from './dto/createReplyChapterdto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { OptionalAccessTokenGuard } from 'src/common/guards/optional-access-token.guard';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('/api/reply')
export class ReplyController {
  constructor(private readonly replyService: ReplyService) {}

  @Post('/create-reply-chapter')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
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
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async upVote(@Body('reply_id') reply_id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.replyService.upVote(reply_id, payload);
  }

  @Post('/downvote')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async downVote(@Body('reply_id') reply_id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.replyService.downVote(reply_id, payload);
  }

  /**
   * Public endpoint: ai cũng xem được reply
   * ✅ chỉ trả reply is_delete=false
   */
  @Get('/:id')
  @UseGuards(OptionalAccessTokenGuard)
  async getALlRepliesOfCommentChapter(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const payload = ((req as any).user ?? null) as JwtPayload | null;
    return this.replyService.getRepliesForCommentChapter(id, payload);
  }

  // ===== ADMIN / COMMUNITY MANAGER =====
  @Patch('/toggle/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMMUNITY_MANAGER)
  async toggleReply(@Param('id') id: string) {
    return this.replyService.toggleReplyVisibility(id);
  }
}
