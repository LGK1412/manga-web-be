import { BadRequestException, Injectable } from '@nestjs/common';
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
  ) {}

  // ================== VALIDATION ==================
  private async checkUser(payload: any) {
    const existingUser = await this.userService.findUserById(payload.user_id);
    if (!existingUser) throw new BadRequestException('Người dùng không tồn tại');
    if (existingUser.status === 'mute')
      throw new BadRequestException('Người dùng bị cấm');
    if (existingUser.role !== 'user' && existingUser.role !== 'author')
      throw new BadRequestException('Bạn không có quyền');
    return existingUser;
  }

  // ================== CREATE COMMENT ==================
  async createCommentChapter(createCommentDto: CreateCommentDTO, payload: any) {
    const existingUser = await this.checkUser(payload);

    // ✅ Validate & ép kiểu chapter_id
    if (!Types.ObjectId.isValid(createCommentDto.chapter_id)) {
      throw new BadRequestException('chapter_id không hợp lệ');
    }
    const chapterId = new Types.ObjectId(createCommentDto.chapter_id);

    const newComment = new this.commentModel({
      chapter_id: chapterId,
      user_id: new Types.ObjectId(payload.user_id),
      content: createCommentDto.content,
    });

    const savedComment = await newComment.save();
    if (!savedComment?._id)
      throw new BadRequestException('Lỗi không tạo được comment');

    // ✅ Lấy thông tin chapter + manga + author
    const chapter = await this.chapterService.getChapterById(chapterId);
    if (!chapter) throw new BadRequestException('Chapter không tồn tại');

    const manga = await this.mangaService.getAuthorByMangaIdForCommentChapter(
      (chapter as any)?.manga_id?._id?.toString?.() ??
        (chapter as any)?.manga_id?.toString?.(),
    );
    const author = manga
      ? await this.userService.getUserById(manga?.authorId)
      : null;

    // ✅ Gửi notification
    if (author) {
      const dto: sendNotificationDto = {
        title: 'Có 1 comment mới',
        body: `${payload.username} đã comment vào Chapter ${chapter?.title} của Truyện: ${manga?.title}`,
        deviceId: author?.device_id ?? [],
        receiver_id:
          (manga?.authorId as any)?._id?.toString?.() ??
          (manga?.authorId as any)?.toString?.(),
        sender_id: payload.user_id,
      };

      // Emit event để cập nhật realtime
      this.eventEmitter.emit('comment_count', { userId: payload.user_id });

      const send_noti_result = await this.notificationClient.sendNotification(
        dto,
      );
      await this.userService.removeDeviceId(
        ((manga?.authorId as any)?._id?.toString?.() ??
          (manga?.authorId as any)?.toString?.()) as string,
        send_noti_result,
      );
    }

    return { success: true };
  }

  // ================== COMMENT QUERY ==================
  async getAllCommentForChapter(chapterId: string, payload: any) {
  const userId = payload?.user_id || null;

  const comments = await this.commentModel.aggregate([
    {
      $match: {
        chapter_id: new Types.ObjectId(chapterId),
        is_delete: false,         // ✅ chỉ lấy comment đang hiển thị
      },
    },
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
        from: 'votecomments',
        localField: '_id',
        foreignField: 'comment_id',
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
              $cond: [
                {
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
                'up',
                {
                  $cond: [
                    {
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
                    'down',
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
        'user.username': 1,
        'user._id': 1,
        upvotes: 1,
        downvotes: 1,
        userVote: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  const replyMap = await this.replyService.getReplyCountByChapter(chapterId);
  return comments.map((c) => ({
    ...c,
    replyCount: replyMap[c._id.toString()]?.replyCount || 0,
    replyUsernames: replyMap[c._id.toString()]?.usernames || [],
  }));
}


  // ================== VOTE ==================
  async upVote(comment_id: string, payload: any) {
    await this.checkUser(payload);

    const commentObjectId = new Types.ObjectId(comment_id);
    const userObjectId = new Types.ObjectId(payload.user_id);

    const existingVote = await this.voteCommentModel.findOne({
      comment_id: commentObjectId,
      user_id: userObjectId,
    });

    if (!existingVote) {
      const newVote = new this.voteCommentModel({
        comment_id: commentObjectId,
        user_id: userObjectId,
        is_up: true,
      });
      await newVote.save();
      return { success: true, message: 'Đã upvote' };
    }

    if (existingVote.is_up === true) {
      await existingVote.deleteOne();
      return { success: true, message: 'Bỏ upvote' };
    } else {
      existingVote.is_up = true;
      await existingVote.save();
      return { success: true, message: 'Đã upvote' };
    }
  }

  async downVote(comment_id: string, payload: any) {
    await this.checkUser(payload);

    const commentObjectId = new Types.ObjectId(comment_id);
    const userObjectId = new Types.ObjectId(payload.user_id);

    const existingVote = await this.voteCommentModel.findOne({
      comment_id: commentObjectId,
      user_id: userObjectId,
    });

    if (!existingVote) {
      const newVote = new this.voteCommentModel({
        comment_id: commentObjectId,
        user_id: userObjectId,
        is_up: false,
      });
      await newVote.save();
      return { success: true, message: 'Đã downvote' };
    }

    if (existingVote.is_up === false) {
      await existingVote.deleteOne();
      return { success: true, message: 'Bỏ downvote' };
    } else {
      existingVote.is_up = false;
      await existingVote.save();
      return { success: true, message: 'Đã downvote' };
    }
  }

  // ================== ADMIN ==================
  async getAllComments() {
    return await this.commentModel
      .find()
      .populate({
        path: 'chapter_id',
        populate: { path: 'manga_id', select: 'title' },
        select: 'title manga_id',
      })
      .populate('user_id', 'username email role')
      .sort({ createdAt: -1 });
  }

  async filterComments({
    storyId,
    chapterId,
    userId,
  }: {
    storyId?: string;
    chapterId?: string;
    userId?: string;
  }) {
    const filter: any = {};
    if (chapterId) filter.chapter_id = new Types.ObjectId(chapterId);
    if (userId) filter.user_id = new Types.ObjectId(userId);

    if (storyId) {
      const chapters = await this.chapterService.findChaptersByMangaId(storyId);
      const chapterIds = chapters.map((ch) => ch._id);
      filter.chapter_id = { $in: chapterIds };
    }

    return await this.commentModel
      .find(filter)
      .populate({
        path: 'chapter_id',
        populate: { path: 'manga_id', select: 'title' },
        select: 'title manga_id',
      })
      .populate('user_id', 'username email role')
      .sort({ createdAt: -1 });
  }

  async toggleCommentVisibility(id: string) {
    const comment = await this.commentModel.findById(id);
    if (!comment) throw new BadRequestException('Comment không tồn tại');

    comment.is_delete = !comment.is_delete;
    await comment.save();

    return {
      success: true,
      message: `Comment ${
        comment.is_delete ? 'đã bị ẩn' : 'đã hiển thị lại'
      }`,
    };
  }
}
