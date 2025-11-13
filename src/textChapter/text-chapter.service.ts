import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chapter, ChapterDocument } from '../schemas/chapter.schema';
import {
  TextChapter,
  TextChapterDocument,
} from '../schemas/text-chapter.schema';
import { CreateChapterWithTextDto } from './dto/create-chapter-with-text.dto';
import { UpdateChapterWithTextDto } from './dto/update-chapter-with-text.dto';
import { Manga, MangaDocument } from 'src/schemas/Manga.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ChapterService {
  constructor(
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
    @InjectModel(TextChapter.name)
    private textChapterModel: Model<TextChapterDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getChapterAllByManga_id(manga_id: Types.ObjectId) {
    return this.chapterModel.aggregate([
      { $match: { manga_id: new Types.ObjectId(manga_id) } },
      {
        $lookup: {
          from: 'textchapters',
          localField: '_id',
          foreignField: 'chapter_id',
          as: 'texts',
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          order: 1,
          price: 1,
          is_published: 1,

          // === trả về cờ AI cho FE ===
          ai_checked: 1,
          ai_verdict: 1,
          risk_score: 1,
          policy_version: 1,
          last_content_hash: 1,

          // === text ===
          'texts._id': 1,
          'texts.content': 1,
          'texts.is_completed': 1,
        },
      },
      { $sort: { order: 1 } },
    ]);
  }

  async getChapterById(_id: Types.ObjectId) {
    const result = await this.chapterModel.aggregate([
      { $match: { _id } },
      {
        $lookup: {
          from: 'textchapters',
          localField: '_id',
          foreignField: 'chapter_id',
          as: 'texts',
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          order: 1,
          price: 1,
          is_published: 1,

          // === cờ AI ===
          ai_checked: 1,
          ai_verdict: 1,
          risk_score: 1,
          policy_version: 1,
          last_content_hash: 1,

          // === text ===
          'texts._id': 1,
          'texts.content': 1,
          'texts.is_completed': 1,
        },
      },
      { $sort: { order: 1 } },
    ]);
    return result[0] || null;
  }

  async createChapterWithText(
    dto: CreateChapterWithTextDto,
  ): Promise<{ chapter: ChapterDocument; text: TextChapterDocument }> {
    const {
      title,
      manga_id,
      price,
      order,
      isPublished,
      content,
      is_completed,
    } = dto;

    // 1) Tạo Chapter + khởi tạo cờ AI
    const chapter = await this.chapterModel.create({
      title,
      manga_id: new Types.ObjectId(manga_id),
      price: price ?? 0,
      order: order ?? 1,
      is_published: isPublished ?? false,

      // === AI flags (invalidate mặc định) ===
      ai_checked: false,
      ai_verdict: null,
      risk_score: null,
      policy_version: null,
      last_content_hash: null,
    });

    // 2) Tạo TextChapter
    const text = await this.textChapterModel.create({
      chapter_id: chapter._id,
      content,
      is_completed: is_completed ?? false,
    });

    // 3) Emit achievement (tạo chapter + publish)
    const manga = await this.mangaModel.findById(manga_id).select('authorId');
    if (manga && manga.authorId) {
      // đếm số chapter tạo
      this.eventEmitter.emit('chapter_create_count', {
        userId: manga.authorId.toString(),
      });

      // nếu tạo chapter ở trạng thái đã publish -> emit publish luôn
      if (isPublished) {
        this.eventEmitter.emit('chapter_published', {
          userId: manga.authorId.toString(),
        });
      }
    } else {
      console.warn('Không tìm thấy authorId cho manga:', manga_id);
    }

    // 4) Phát event nội dung đổi (cho ModerationModule / AI)
    this.eventEmitter.emit('chapter.content_changed', {
      chapterId: chapter._id.toString(),
      // contentHash: null // FE/BE khác có thể set sau ở endpoint riêng
    });

    return { chapter, text };
  }

  async updateChapter(
    id: Types.ObjectId,
    dto: UpdateChapterWithTextDto,
  ): Promise<{
    chapter: ChapterDocument | null;
    text: TextChapterDocument | null;
  }> {
    const { title, price, order, isPublished, content, is_completed } = dto;

    // 1) Lấy chapter cũ để check publish transition
    const oldChapter = await this.chapterModel.findById(id).lean();
    const wasPublished = oldChapter?.is_published || false;

    // 2) Check xem nội dung có thay đổi không (để invalidate AI)
    const contentChanged = content !== undefined || title !== undefined;

    // 3) Update chapter trước
    const chapter = await this.chapterModel.findByIdAndUpdate(
      id,
      {
        ...(title !== undefined && { title }),
        ...(price !== undefined && { price }),
        ...(order !== undefined && { order }),
        ...(isPublished !== undefined && { is_published: isPublished }),
      },
      { new: true }, // return updated doc
    );

    // 4) Update textChapter (nếu có)
    let text: TextChapterDocument | null = null;
    if (content !== undefined || is_completed !== undefined) {
      text = await this.textChapterModel.findOneAndUpdate(
        { chapter_id: id },
        {
          ...(content !== undefined && { content }),
          ...(is_completed !== undefined && { is_completed }),
        },
        { new: true },
      );
    }

    // 5) Nếu nội dung/tiêu đề thay đổi → Invalidate AI flags + phát event
    if (contentChanged) {
      await this.chapterModel.updateOne(
        { _id: id },
        {
          $set: {
            ai_checked: false,
            ai_verdict: null,
            risk_score: null,
            policy_version: null,
            // không đụng last_content_hash vì chưa có hash mới
          },
        },
      );

      this.eventEmitter.emit('chapter.content_changed', {
        chapterId: id.toString(),
        // contentHash: <hash mới nếu có>
      });
    }

    // 6) Emit event nếu chapter được publish (false -> true)
    if (isPublished !== undefined && isPublished && !wasPublished && chapter) {
      const manga = await this.mangaModel
        .findById(chapter.manga_id)
        .select('authorId');
      if (manga && manga.authorId) {
        this.eventEmitter.emit('chapter_published', {
          userId: manga.authorId.toString(),
        });
      }
    }

    // (OPTIONAL) Guard nếu muốn chặn publish khi AI chưa pass:
    /*
    if (isPublished === true) {
      const cur = await this.chapterModel
        .findById(id)
        .select('ai_checked ai_verdict')
        .lean();
      if (!cur?.ai_checked || cur?.ai_verdict === 'BLOCK') {
        throw new Error(
          'Chương chưa vượt kiểm duyệt tự động hoặc bị BLOCK — không thể đăng.',
        );
      }
    }
    */

    return { chapter, text };
  }

  async deleteChapterAndText(
    id: Types.ObjectId,
  ): Promise<{ deletedChapter: any; deletedTexts: any }> {
    // Xoá text chapters trước
    const deletedTexts = await this.textChapterModel.deleteMany({
      chapter_id: id,
    });

    // Xoá chapter
    const deletedChapter = await this.chapterModel.findByIdAndDelete(id);

    return { deletedChapter, deletedTexts };
  }
}
