import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ReplyService } from './reply.service';
import { CreateReplyChapterDTO } from './dto/createReplyChapterdto';
import type { Request } from 'express';

@Controller('/api/reply')
export class ReplyController {
    constructor(
        private readonly replyService: ReplyService,
        private jwtService: JwtService
    ) { }

    @Post("/create-reply-chapter")
    async createCommentChapter(@Body() createReplyChaperDto: CreateReplyChapterDTO, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token)
        //console.log(createReplyChaperDto);
        const result = await this.replyService.createReplyChapter(createReplyChaperDto, payload)
        return { success: true, result: result }
    }

    @Post("/upvote")
    async upVote(@Body("reply_id") reply_id: string, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token);
        return await this.replyService.upVote(reply_id, payload);
    }

    @Post("/downvote")
    async downVote(@Body("reply_id") reply_id: string, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token);
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
