import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationClient } from 'src/notification-gateway/notification.client';
import { Reply } from 'src/schemas/Reply.schema';
import { UserService } from 'src/user/user.service';
import { CreateReplyChapterDTO } from './dto/createReplyChapterdto';
import { ChapterServiceOnlyNormalChapterInfor } from 'src/chapter/chapter.service';
import { MangaService } from 'src/manga/manga.service';
import { sendNotificationDto } from './dto/sendNoti.dto';
import { VoteReply } from 'src/schemas/VoteReply.schema';

@Injectable()
export class ReplyService {
    constructor(
        private readonly notificationClient: NotificationClient,
        @InjectModel(Reply.name) private replyModel: Model<Reply>,
        private userService: UserService,
        private chapterService: ChapterServiceOnlyNormalChapterInfor,
        private mangaService: MangaService,
        @InjectModel(VoteReply.name) private voteReplyModel: Model<VoteReply>
    ) { }



    async checkLegitUser(payload: any) {
        const existingUser = await this.userService.findUserById(payload.user_id)
        if (!existingUser) {
            throw new BadRequestException("Người dùng không tồn tại")
        }

        if (existingUser.status === "mute") {
            throw new BadRequestException("Người dùng bị cấm")
        }

        if (existingUser.role !== "user" && existingUser.role !== "author") {
            throw new BadRequestException("Bạn không có quyền")
        }
    }

    async createReplyChapter(createReplyChapterDTO: CreateReplyChapterDTO, payload: any) {
        await this.checkLegitUser(payload);
        // console.log(payload);
        // Chuyển string id sang ObjectId
        const newReplyChapter = new this.replyModel({
            comment_id: new Types.ObjectId(createReplyChapterDTO.comment_id),
            chapter_id: new Types.ObjectId(createReplyChapterDTO.chapter_id),
            user_id: new Types.ObjectId(payload.user_id),
            content: createReplyChapterDTO.content,
        });

        const savedReplyChapter = await newReplyChapter.save();
        if (savedReplyChapter._id) {
            const chapter = await this.chapterService.getChapterById(createReplyChapterDTO.chapter_id)
            const manga = await this.mangaService.getAuthorByMangaIdForCommentChapter(chapter?.manga_id._id) // lấy thông tin truyện
            const receiver = await this.userService.getUserById(createReplyChapterDTO.receiver_id)
            // console.log(chapter);
            // console.log(manga);
            const dto: sendNotificationDto = {
                title: "Có 1 phản hồi mới",
                body: `${payload.username} đã phản hồi bình luận tại Chapter ${chapter?.title}, Truyện: ${manga?.title}`,
                deviceId: receiver?.device_id ?? [],
                receiver_id: createReplyChapterDTO.receiver_id,
                sender_id: payload.user_id
            };

            const send_noti_result = await this.notificationClient.sendNotification(dto);
            await this.userService.removeDeviceId(manga?.authorId as unknown as string, send_noti_result);

            return savedReplyChapter
        } else {
            throw new BadRequestException("Lỗi không tạo dược comment")
        }

    }

    async getRepliesForCommentChapter(comment_id: string, payload: any) {
        const userId = payload?.user_id || null; // an toàn nếu user chưa login

        return await this.replyModel.aggregate([
            { $match: { comment_id: new Types.ObjectId(comment_id) } },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [{ $project: { username: 1, _id: 1 } }]
                }
            },
            { $unwind: "$user" },
            {
                $lookup: {
                    from: "votereplies",
                    localField: "_id",
                    foreignField: "reply_id",
                    as: "votes"
                }
            },
            {
                $addFields: {
                    upvotes: {
                        $size: {
                            $filter: { input: "$votes", as: "v", cond: { $eq: ["$$v.is_up", true] } }
                        }
                    },
                    downvotes: {
                        $size: {
                            $filter: { input: "$votes", as: "v", cond: { $eq: ["$$v.is_up", false] } }
                        }
                    },
                    userVote: userId
                        ? {
                            $switch: {
                                branches: [
                                    {
                                        case: {
                                            $gt: [
                                                {
                                                    $size: {
                                                        $filter: {
                                                            input: "$votes",
                                                            as: "v",
                                                            cond: {
                                                                $and: [
                                                                    { $eq: ["$$v.user_id", new Types.ObjectId(userId)] },
                                                                    { $eq: ["$$v.is_up", true] }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                0
                                            ]
                                        },
                                        then: "up"
                                    },
                                    {
                                        case: {
                                            $gt: [
                                                {
                                                    $size: {
                                                        $filter: {
                                                            input: "$votes",
                                                            as: "v",
                                                            cond: {
                                                                $and: [
                                                                    { $eq: ["$$v.user_id", new Types.ObjectId(userId)] },
                                                                    { $eq: ["$$v.is_up", false] }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                0
                                            ]
                                        },
                                        then: "down"
                                    }
                                ],
                                default: null
                            }
                        }
                        : null
                }
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    createdAt: 1,
                    "user.username": 1,
                    "user._id": 1,
                    upvotes: 1,
                    downvotes: 1,
                    userVote: 1
                }
            },
            { $sort: { createdAt: -1 } }
        ]);
    }

    async getReplyCountByChapter(chapterId: string) {
        const replyData = await this.replyModel.aggregate([
            {
                $match: { chapter_id: new Types.ObjectId(chapterId) }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [
                        { $project: { username: 1, _id: 0 } }
                    ]
                }
            },
            { $unwind: "$user" },
            {
                $group: {
                    _id: "$comment_id",
                    replyCount: { $sum: 1 },
                    usernames: { $addToSet: "$user.username" } // tránh trùng tên
                }
            }
        ]);

        // Trả về object dễ merge
        return Object.fromEntries(
            replyData.map(r => [
                r._id.toString(),
                {
                    replyCount: r.replyCount,
                    usernames: r.usernames
                }
            ])
        );
    }

    async upVote(reply_id: string, payload: any) {
        await this.checkLegitUser(payload);

        const replyObjectId = new Types.ObjectId(reply_id);
        const userObjectId = new Types.ObjectId(payload.user_id);

        const existingVote = await this.voteReplyModel.findOne({
            reply_id: replyObjectId,
            user_id: userObjectId,
        });

        if (!existingVote) {
            const newVote = new this.voteReplyModel({
                reply_id: replyObjectId,
                user_id: userObjectId,
                is_up: true,
            });
            await newVote.save();
            return { success: true, message: "Đã upvote reply" };
        }

        if (existingVote.is_up === true) {
            await existingVote.deleteOne();
            return { success: true, message: "Bỏ upvote reply" };
        } else {
            existingVote.is_up = true;
            await existingVote.save();
            return { success: true, message: "Đã upvote reply" };
        }
    }

    async downVote(reply_id: string, payload: any) {
        await this.checkLegitUser(payload);

        const replyObjectId = new Types.ObjectId(reply_id);
        const userObjectId = new Types.ObjectId(payload.user_id);

        const existingVote = await this.voteReplyModel.findOne({
            reply_id: replyObjectId,
            user_id: userObjectId,
        });

        if (!existingVote) {
            const newVote = new this.voteReplyModel({
                reply_id: replyObjectId,
                user_id: userObjectId,
                is_up: false,
            });
            await newVote.save();
            return { success: true, message: "Đã downvote reply" };
        }

        if (existingVote.is_up === false) {
            await existingVote.deleteOne();
            return { success: true, message: "Bỏ downvote reply" };
        } else {
            existingVote.is_up = false;
            await existingVote.save();
            return { success: true, message: "Đã downvote reply" };
        }
    }
}
