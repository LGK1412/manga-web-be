import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ReplyService } from './reply.service';
import { CreateReplyChapterDTO } from './dto/createReplyChapterdto';
import type { Request } from 'express';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('/api/reply')
export class ReplyController {
    constructor(
        private readonly replyService: ReplyService,
        private jwtService: JwtService
    ) { }

    @Post("/create-reply-chapter")
    @UseGuards(AccessTokenGuard)
    async createCommentChapter(@Body() createReplyChaperDto: CreateReplyChapterDTO, @Req() req: Request) {
        const payload = (req as any).user;
        const result = await this.replyService.createReplyChapter(createReplyChaperDto, payload)
        return { success: true, result: result }
    }

    @Post("/upvote")
    @UseGuards(AccessTokenGuard)
    async upVote(@Body("reply_id") reply_id: string, @Req() req: Request) {
        const payload = (req as any).user;
        return await this.replyService.upVote(reply_id, payload);
    }

    @Post("/downvote")
    @UseGuards(AccessTokenGuard)
    async downVote(@Body("reply_id") reply_id: string, @Req() req: Request) {
        const payload = (req as any).user;
        return await this.replyService.downVote(reply_id, payload);
    }

    @Get("/:id")
    async getALlRepliesOfCommentChapter(@Param("id") id: string, @Req() req: Request) {
        let payload: any = null;
        const token = req.cookies?.access_token;

        if (token) {
            try {
                payload = this.jwtService.verify(token);
            } catch (e) {
                payload = null; // token sai hoặc hết hạn -> vẫn cho xem
            }
        }

        return await this.replyService.getRepliesForCommentChapter(id, payload);
    }

}
