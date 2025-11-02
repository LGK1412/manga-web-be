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
import { ReplyService } from 'src/reply/reply.service';
import { VoteComment } from 'src/schemas/VoteComment.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CommentService {
    constructor(
        private readonly notificationClient: NotificationClient,
        @InjectModel(Comment.name) private commentModel: Model<Comment>,
        private userService: UserService,
        private chapterService: ChapterServiceOnlyNormalChapterInfor,
        private mangaService: MangaService,
        private replyService: ReplyService,
        @InjectModel(VoteComment.name) private voteCommentModel: Model<VoteComment>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    private async checkUser(payload: any) {
        const existingUser = await this.userService.findUserById(payload.user_id)
        if (!existingUser) {
            throw new BadRequestException("Người dùng không tồn tại")
        }

        if (existingUser.status === "mute") {
            throw new BadRequestException("Người dùng bị cấm")
        }

        if (existingUser.role !== "user" && existingUser.role !== "author") {
            throw new BadRequestException("Bạn Không có quyền")
        }

        return existingUser
    }

    async createCommentChapter(createCommentDto: CreateCommentDTO, payload: any) {

        const existingUser = await this.checkUser(payload)

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

            //Emit
            this.eventEmitter.emit("comment_count", { userId: payload.user_id })

            const send_noti_result = await this.notificationClient.sendNotification(dto);
            await this.userService.removeDeviceId(manga?.authorId as unknown as string, send_noti_result);

            return { success: true }
        } else {
            throw new BadRequestException("Lỗi không tạo dược comment")
        }
    }

    async getAllCommentForChapter(chapterId: string, payload: any) {
        const userId = payload?.user_id || null; // ✅ an toàn, không crash
        // console.log(userId);

        const comments = await this.commentModel.aggregate([
            { $match: { chapter_id: new Types.ObjectId(chapterId) } },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [{ $project: { username: 1, _id: 1 } }],
                },
            },
            { $unwind: "$user" },
            {
                $lookup: {
                    from: "votecomments",
                    localField: "_id",
                    foreignField: "comment_id",
                    as: "votes",
                },
            },
            {
                $addFields: {
                    upvotes: {
                        $size: {
                            $filter: {
                                input: "$votes",
                                as: "v",
                                cond: { $eq: ["$$v.is_up", true] },
                            },
                        },
                    },
                    downvotes: {
                        $size: {
                            $filter: {
                                input: "$votes",
                                as: "v",
                                cond: { $eq: ["$$v.is_up", false] },
                            },
                        },
                    },
                    userVote: userId
                        ? {
                            $cond: [
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: "$votes",
                                                    as: "v",
                                                    cond: {
                                                        $and: [
                                                            {
                                                                $eq: [
                                                                    "$$v.user_id",
                                                                    new Types.ObjectId(userId),
                                                                ],
                                                            },
                                                            { $eq: ["$$v.is_up", true] },
                                                        ],
                                                    },
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                                "up",
                                {
                                    $cond: [
                                        {
                                            $gt: [
                                                {
                                                    $size: {
                                                        $filter: {
                                                            input: "$votes",
                                                            as: "v",
                                                            cond: {
                                                                $and: [
                                                                    {
                                                                        $eq: [
                                                                            "$$v.user_id",
                                                                            new Types.ObjectId(userId),
                                                                        ],
                                                                    },
                                                                    { $eq: ["$$v.is_up", false] },
                                                                ],
                                                            },
                                                        },
                                                    },
                                                },
                                                0,
                                            ],
                                        },
                                        "down",
                                        null,
                                    ],
                                },
                            ],
                        }
                        : null,
                },
            },
            {
                $project: {
                    _id: 1,
                    chapter_id: 1,
                    user_id: 1,
                    content: 1,
                    is_delete: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    "user.username": 1,
                    "user._id": 1,
                    upvotes: 1,
                    downvotes: 1,
                    userVote: 1,
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        const replyMap = await this.replyService.getReplyCountByChapter(chapterId);

        const comment = comments.map((c) => ({
            ...c,
            replyCount: replyMap[c._id.toString()]?.replyCount || 0,
            replyUsernames: replyMap[c._id.toString()]?.usernames || [],
        }));

        // console.log(comment);

        return comment
    }

    async upVote(comment_id: string, payload: any) {
        await this.checkUser(payload);
        // console.log("comment_id:", comment_id);
        // console.log("user_id:", payload.user_id);
        // Ép sang ObjectId cho chắc
        const commentObjectId = new Types.ObjectId(comment_id);
        const userObjectId = new Types.ObjectId(payload.user_id);

        // Tìm xem user đã vote comment này chưa
        const existingVote = await this.voteCommentModel.findOne({
            comment_id: commentObjectId,
            user_id: userObjectId,
        });

        if (!existingVote) {
            // Chưa có -> tạo mới (upvote)
            const newVote = new this.voteCommentModel({
                comment_id: commentObjectId,
                user_id: userObjectId,
                is_up: true,
            });
            await newVote.save();
            return { success: true, message: "Đã upvote" };
        }

        // Nếu đã có -> toggle
        if (existingVote.is_up === true) {
            await existingVote.deleteOne();
            return { success: true, message: "Bỏ upvote" };
        } else {
            existingVote.is_up = true;
            await existingVote.save();
            return { success: true, message: "Đã upvote" };
        }
    }

    async downVote(comment_id: string, payload: any) {
        await this.checkUser(payload);

        // Ép sang ObjectId
        const commentObjectId = new Types.ObjectId(comment_id);
        const userObjectId = new Types.ObjectId(payload.user_id);

        // Kiểm tra xem user đã vote chưa
        const existingVote = await this.voteCommentModel.findOne({
            comment_id: commentObjectId,
            user_id: userObjectId,
        });

        if (!existingVote) {
            // Chưa có -> tạo mới (downvote)
            const newVote = new this.voteCommentModel({
                comment_id: commentObjectId,
                user_id: userObjectId,
                is_up: false,
            });
            await newVote.save();
            return { success: true, message: "Đã downvote" };
        }

        // Nếu đã có -> toggle
        if (existingVote.is_up === false) {
            await existingVote.deleteOne();
            return { success: true, message: "Bỏ downvote" };
        } else {
            existingVote.is_up = false;
            await existingVote.save();
            return { success: true, message: "Đã downvote" };
        }
    }


}
