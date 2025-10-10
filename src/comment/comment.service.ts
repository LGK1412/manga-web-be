import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment } from 'src/schemas/comment.schema';
import { CreateCommentDTO } from './dto/createComment.dto';
import { UserService } from 'src/user/user.service';
import { ChapterServiceOnlyNormalChapterInfor } from 'src/chapter/chapter.service';
import { MangaService } from 'src/manga/manga.service';
import { sendNotificationDto } from './dto/sendNoti.dto';
import { NotificationClient } from 'src/notification-gateway/notification.client';

@Injectable()
export class CommentService {
    constructor(
        private readonly notificationClient: NotificationClient,
        @InjectModel(Comment.name) private commentModel: Model<Comment>,
        private userService: UserService,
        private chapterService: ChapterServiceOnlyNormalChapterInfor,
        private mangaService: MangaService
    ) { }

    async createCommentChapter(createCommentDto: CreateCommentDTO, payload: any) {

        const existingUser = await this.userService.findUserById(payload.user_id)
        if (!existingUser) {
            throw new BadRequestException("Người dùng không tồn tại")
        }

        if (existingUser.status === "mute") {
            throw new BadRequestException("Người dùng bị cấm comment")
        }

        if (existingUser.role !== "user" && existingUser.role !== "author"){
            throw new BadRequestException("Bạn Không có quyền comment")
        }

        // console.log(payload);
        // Chuyển string id sang ObjectId
        const newComment = new this.commentModel({
            chapter_id: new Types.ObjectId(createCommentDto.chapter_id),
            user_id: new Types.ObjectId(payload.user_id),
            content: createCommentDto.content,
        });

        const savedComment = await newComment.save();

        if (savedComment._id) {
            const chapter = await this.chapterService.getChapterById(createCommentDto.chapter_id)
            const manga = await this.mangaService.getAuthorByMangaIdForCommentChapter(chapter?.manga_id._id)
            const author = await this.userService.getUserById(manga?.authorId)
            // console.log(chapter);
            // console.log(manga);
            const dto: sendNotificationDto = {
                title: "Có 1 comment mới",
                body: `${payload.username} đã comment vào Chapter ${chapter?.title} của Truyện: ${manga?.title}`,
                deviceId: author?.device_id ?? [], // lấy từ đâu đó
                receiver_id: manga?.authorId._id as unknown as string, // ép kiểu sang string
                sender_id: payload.user_id
            };

            const send_noti_result = await this.notificationClient.sendNotification(dto);
            await this.userService.removeDeviceId(manga?.authorId as unknown as string, send_noti_result);

            return { success: true }
        } else {
            throw new BadRequestException("Lỗi không tạo dược comment")
        }

    }

    async getAllCommentForChapter(id) {
        return await this.commentModel.find({ chapter_id: new Types.ObjectId(id) }).populate("user_id")
    }
}
