import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationService } from 'src/notification/notification.service';
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
    private readonly notificationService: NotificationService,
    @InjectModel(Reply.name) private replyModel: Model<Reply>,
    private userService: UserService,
    private chapterService: ChapterServiceOnlyNormalChapterInfor,
    private mangaService: MangaService,
    @InjectModel(VoteReply.name) private voteReplyModel: Model<VoteReply>,
  ) {}

  private async checkLegitUser(payload: any) {
    const existingUser = await this.userService.findUserById(payload.user_id);
    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (existingUser.status === 'mute') {
      throw new BadRequestException('Người dùng bị cấm');
    }

    if (existingUser.role !== 'user' && existingUser.role !== 'author') {
      throw new BadRequestException('Bạn không có quyền');
    }
  }

  async createReplyChapter(
    createReplyChapterDTO: CreateReplyChapterDTO,
    payload: any,
  ) {
    await this.checkLegitUser(payload);

    // Lưu reply
    const newReplyChapter = new this.replyModel({
      comment_id: new Types.ObjectId(createReplyChapterDTO.comment_id),
      chapter_id: new Types.ObjectId(createReplyChapterDTO.chapter_id),
      user_id: new Types.ObjectId(payload.user_id),
      content: createReplyChapterDTO.content,
    });

    const savedReplyChapter = await newReplyChapter.save();
    if (!savedReplyChapter._id) {
      throw new BadRequestException('Failed to create comment');
    }

    // ✅ Truyền ObjectId vào getChapterById
    const chapter = await this.chapterService.getChapterById(
      new Types.ObjectId(createReplyChapterDTO.chapter_id),
    );

    // ✅ Lấy mangaId an toàn (support cả ObjectId thô lẫn object {_id})
    const mangaId =
      (chapter as any)?.manga_id?._id ?? (chapter as any)?.manga_id;
    if (!mangaId) {
      throw new InternalServerErrorException(
        'Chapter does not have a valid manga_id',
      );
    }

    // ✅ Tham số là string | ObjectId (không còn undefined)
    const manga = await this.mangaService.getAuthorByMangaIdForCommentChapter(
      mangaId,
    );

    const receiver = await this.userService.getUserById(
      createReplyChapterDTO.receiver_id,
    );

    const dto: sendNotificationDto = {
      title: 'New reply',
      body: `${payload.username} replied to a comment in Chapter ${chapter?.title}, Story: ${manga?.title}`,
      deviceId: receiver?.device_id ?? [],
      receiver_id: createReplyChapterDTO.receiver_id,
      sender_id: payload.user_id,
    };

    const send_noti_result = await this.notificationService.createNotification(
      dto,
    );

    // Nếu removeDeviceId yêu cầu string, đảm bảo ép kiểu an toàn
    // (trong nhiều schema authorId có thể là ObjectId hoặc populate object)
    const authorIdStr =
      (manga as any)?.authorId?._id?.toString?.() ??
      (manga as any)?.authorId?.toString?.();
    if (authorIdStr) {
      await this.userService.removeDeviceId(authorIdStr, send_noti_result);
    }

    return savedReplyChapter;
  }

  async getRepliesForCommentChapter(comment_id: string, payload: any) {
    const userId = payload?.user_id || null; // an toàn nếu user chưa login

    return await this.replyModel.aggregate([
      { $match: { comment_id: new Types.ObjectId(comment_id) } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { username: 1, _id: 1 } }],
        },
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'votereplies',
          localField: '_id',
          foreignField: 'reply_id',
          as: 'votes',
        },
      },
      {
        $addFields: {
          upvotes: {
            $size: {
              $filter: {
                input: '$votes',
                as: 'v',
                cond: { $eq: ['$$v.is_up', true] },
              },
            },
          },
          downvotes: {
            $size: {
              $filter: {
                input: '$votes',
                as: 'v',
                cond: { $eq: ['$$v.is_up', false] },
              },
            },
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
                                input: '$votes',
                                as: 'v',
                                cond: {
                                  $and: [
                                    {
                                      $eq: [
                                        '$$v.user_id',
                                        new Types.ObjectId(userId),
                                      ],
                                    },
                                    { $eq: ['$$v.is_up', true] },
                                  ],
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      then: 'up',
                    },
                    {
                      case: {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: '$votes',
                                as: 'v',
                                cond: {
                                  $and: [
                                    {
                                      $eq: [
                                        '$$v.user_id',
                                        new Types.ObjectId(userId),
                                      ],
                                    },
                                    { $eq: ['$$v.is_up', false] },
                                  ],
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      then: 'down',
                    },
                  ],
                  default: null,
                },
              }
            : null,
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          createdAt: 1,
          'user.username': 1,
          'user._id': 1,
          upvotes: 1,
          downvotes: 1,
          userVote: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async getReplyCountByChapter(chapterId: string) {
    const replyData = await this.replyModel.aggregate([
      {
        $match: { chapter_id: new Types.ObjectId(chapterId) },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { username: 1, _id: 0 } }],
        },
      },
      { $unwind: '$user' },
      {
        $group: {
          _id: '$comment_id',
          replyCount: { $sum: 1 },
          usernames: { $addToSet: '$user.username' }, // tránh trùng tên
        },
      },
    ]);

    // Trả về object dễ merge
    return Object.fromEntries(
      replyData.map((r) => [
        r._id.toString(),
        {
          replyCount: r.replyCount,
          usernames: r.usernames,
        },
      ]),
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
      return { success: true, message: 'Reply upvoted' };
    }

    if (existingVote.is_up === true) {
      await existingVote.deleteOne();
      return { success: true, message: 'Reply upvote removed' };
    } else {
      existingVote.is_up = true;
      await existingVote.save();
      return { success: true, message: 'Reply upvoted' };
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
      return { success: true, message: 'Reply downvoted' };
    }

    if (existingVote.is_up === false) {
      await existingVote.deleteOne();
      return { success: true, message: 'Reply downvote removed' };
    } else {
      existingVote.is_up = false;
      await existingVote.save();
      return { success: true, message: 'Reply downvoted' };
    }
  }
}
