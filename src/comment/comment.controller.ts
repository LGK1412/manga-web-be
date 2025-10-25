import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { CommentService } from './comment.service';
import type { Request } from 'express';
import { JwtService } from "@nestjs/jwt";
import { CreateCommentDTO } from './dto/createComment.dto';

@Controller('/api/comment')
export class CommentController {
    constructor(
        private readonly commentService: CommentService,
        private jwtService: JwtService
    ) { }

    @Post("/create-comment")
    async createCommentChapter(@Body() createCommentDto: CreateCommentDTO, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token)
        const result = await this.commentService.createCommentChapter(createCommentDto, payload)
        return { success: true }
    }

    @Post("/upvote")
    async upVote(@Body() body: any, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token)
        return await this.commentService.upVote(body.comment_id, payload)
    }

    @Post("/downvote")
    async downVote(@Body() body: any, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token)
        return await this.commentService.downVote(body.comment_id, payload)
    }

    @Get("/all-comment-chapter/:id")
    async getAllCommentForChapter(@Param('id') id: string, @Req() req: Request) {
        let payload: any = null; // hoặc: let payload: object | null = null;
        const token = req.cookies?.access_token;

        if (token) {
            try {
                payload = this.jwtService.verify(token);
            } catch (e) {
                payload = null;
            }
        }

        return await this.commentService.getAllCommentForChapter(id, payload);
    }

}
