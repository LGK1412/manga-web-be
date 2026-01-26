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

  private async checkUser(id: string) {
    const existingUser = await this.userModel.findOne({ _id: id });
    if (!existingUser) {
      throw new BadRequestException('User does not exist');
    }
    if (existingUser.role != "user" && existingUser.role != "author") {
      throw new BadRequestException('User does not have permission');
    }
    if (existingUser.status == "ban") {
      throw new BadRequestException('User does not have permission');
    }
    return existingUser;
  }

  async buyChapter(userId: string, chapterId: string) {
    // Lấy thông tin chapter kèm manga & author
    const chapter = await this.chapterModel
      .findById(chapterId)
      .populate({
        path: 'manga_id',
        select: 'authorId title',
      })
      .lean();

    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.price <= 0) {
      throw new BadRequestException('This chapter is free');
    }

    const user = await this.checkUser(userId);

    // Check if already purchased
    const existed = await this.purchaseModel.findOne({ user: userId, chapter: chapterId });
    if (existed) {
      throw new BadRequestException('You have already purchased this chapter');
    }

    if (user.point < chapter.price) {
      throw new BadRequestException('Insufficient points to purchase');
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
      message: 'Chapter purchased successfully',
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
