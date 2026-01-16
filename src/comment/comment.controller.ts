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

import { CommentService } from './comment.service';
import { CreateCommentDTO } from './dto/createComment.dto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { OptionalAccessTokenGuard } from 'src/common/guards/optional-access-token.guard';

import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('/api/comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  // ===== USER =====

  @Post('/create-comment')
  @UseGuards(AccessTokenGuard)
  async createCommentChapter(
    @Body() createCommentDto: CreateCommentDTO,
    @Req() req: Request,
  ) {
    const payload = (req as any).user as JwtPayload;
    return this.commentService.createCommentChapter(createCommentDto, payload);
  }

  @Post('/upvote')
  @UseGuards(AccessTokenGuard)
  async upVote(@Body() body: any, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.commentService.upVote(body.comment_id, payload);
  }

  @Post('/downvote')
  @UseGuards(AccessTokenGuard)
  async downVote(@Body() body: any, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.commentService.downVote(body.comment_id, payload);
  }

  /**
   * Public: xem comment của chapter
   * Nếu có token hợp lệ => req.user có payload để service biết user đã vote, v.v.
   */
  @Get('/all-comment-chapter/:id')
  @UseGuards(OptionalAccessTokenGuard)
  async getAllCommentForChapter(@Param('id') id: string, @Req() req: Request) {
    const payload = ((req as any).user ?? null) as JwtPayload | null;
    return this.commentService.getAllCommentForChapter(id, payload);
  }

  // ===== ADMIN / MODERATOR =====

  @Get('/all')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  async getAllComments() {
    return this.commentService.getAllComments();
  }

  @Post('/filter')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  async filterComments(
    @Body() body: { storyId?: string; chapterId?: string; userId?: string },
  ) {
    return this.commentService.filterComments(body);
  }

  @Patch('/toggle/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  async toggleComment(@Param('id') id: string) {
    return this.commentService.toggleCommentVisibility(id);
  }
}
