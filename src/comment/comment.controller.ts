import { Body, Controller, Get, Param, Post, Req, Patch, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import type { Request } from 'express';
import { JwtService } from "@nestjs/jwt";
import { CreateCommentDTO } from './dto/createComment.dto';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('/api/comment')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private jwtService: JwtService
  ) {}

  // ===== USER =====

  @Post("/create-comment")
  @UseGuards(AccessTokenGuard)
  async createCommentChapter(
    @Body() createCommentDto: CreateCommentDTO,
    @Req() req: Request
  ) {
    const payload = (req as any).user;
    return await this.commentService.createCommentChapter(createCommentDto, payload);
  }

  @Post("/upvote")
  @UseGuards(AccessTokenGuard)
  async upVote(@Body() body: any, @Req() req: Request) {
    const payload = (req as any).user;
    return await this.commentService.upVote(body.comment_id, payload);
  }

  @Post("/downvote")
  @UseGuards(AccessTokenGuard)
  async downVote(@Body() body: any, @Req() req: Request) {
    const payload = (req as any).user;
    return await this.commentService.downVote(body.comment_id, payload);
  }

  @Get("/all-comment-chapter/:id")
  async getAllCommentForChapter(@Param('id') id: string, @Req() req: Request) {
    let payload: any = null;
    const token = req.cookies?.access_token;

    if (token) {
      try {
        payload = this.jwtService.verify(token);
      } catch {
        payload = null;
      }
    }

    return await this.commentService.getAllCommentForChapter(id, payload);
  }

  // ===== ADMIN =====

  @Get("/all")
  async getAllComments() {
    return await this.commentService.getAllComments();
  }

  @Post("/filter")
  async filterComments(
    @Body() body: { storyId?: string; chapterId?: string; userId?: string }
  ) {
    return await this.commentService.filterComments(body);
  }

  @Patch("/toggle/:id")
  async toggleComment(@Param('id') id: string) {
    return await this.commentService.toggleCommentVisibility(id);
  }
}
