import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chapter } from 'src/schemas/chapter.schema';
import { User } from 'src/schemas/User.schema';
import { ChapterPurchase } from 'src/schemas/chapter-purchase.schema';

@Injectable()
export class ChapterPurchaseService {
  constructor(
    @InjectModel(Chapter.name) private chapterModel: Model<Chapter>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(ChapterPurchase.name) private purchaseModel: Model<ChapterPurchase>,
  ) { }

  async buyChapter(userId: string, chapterId: string) {
    // Lấy thông tin chapter kèm manga & author
    const chapter = await this.chapterModel
      .findById(chapterId)
      .populate({
        path: 'manga_id',
        select: 'authorId title',
      })
      .lean();

    if (!chapter) throw new NotFoundException('Không tìm thấy chapter');
    if (chapter.price <= 0) {
      throw new BadRequestException('Chapter này miễn phí');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    // Kiểm tra đã mua chưa
    const existed = await this.purchaseModel.findOne({ user: userId, chapter: chapterId });
    if (existed) {
      throw new BadRequestException('Bạn đã mua chapter này rồi');
    }

    if (user.point < chapter.price) {
      throw new BadRequestException('Không đủ điểm để mua');
    }

    // --- Ép kiểu để TS hiểu manga_id có authorId ---
    const manga = chapter.manga_id as { _id: Types.ObjectId; authorId?: Types.ObjectId };

    // --- Trừ điểm user ---
    user.point -= chapter.price;
    await user.save();

    // --- Cộng điểm cho tác giả ---
    if (manga?.authorId) {
      const author = await this.userModel.findById(manga.authorId);
      if (author) {
        author.author_point = (author.author_point || 0) + chapter.price;
        await author.save();
      }
    }

    // --- Tạo bản ghi mua ---
    const purchase = await this.purchaseModel.create({
      userId: new Types.ObjectId(userId),
      chapterId: new Types.ObjectId(chapterId),
      price: chapter.price
    });

    return {
      message: 'Mua chapter thành công',
      purchase,
      remainPoint: user.point,
    };
  }

  async getPurchaseHistory(userId: string) {
    const userOid = new Types.ObjectId(userId);

    const history = await this.purchaseModel
      .find({ userId: userOid })
      .populate({
        path: 'chapterId',
        select: 'title order manga_id',
        populate: {
          path: 'manga_id',
          select: 'title authorId',
          populate: {
            path: 'authorId',
            select: 'username avatar',
          },
        },
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return history;
  }

}
