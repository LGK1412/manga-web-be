import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
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

    @Get("/all-comment-chapter/:id")
    async getAllCommentForChapter(@Param('id') id: string) {
        return await this.commentService.getAllCommentForChapter(id)
    }
}
