import { Injectable, BadRequestException } from '@nestjs/common';
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
import {
  ChapterModeration,
  ChapterModerationDocument,
} from '../schemas/chapter-moderation.schema';

@Injectable()
export class ChapterService {
  constructor(
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
    @InjectModel(TextChapter.name)
    private textChapterModel: Model<TextChapterDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    @InjectModel(ChapterModeration.name)
    private chapterModerationModel: Model<ChapterModerationDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

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
          ai_checked: 1,
          ai_verdict: 1,
          risk_score: 1,
          policy_version: 1,
          last_content_hash: 1,
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
          ai_checked: 1,
          ai_verdict: 1,
          risk_score: 1,
          policy_version: 1,
          last_content_hash: 1,
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

    const chapterOrder = order ?? 1;
    const existingChapter = await this.chapterModel.findOne({
      manga_id: new Types.ObjectId(manga_id),
      order: chapterOrder,
    });

    if (existingChapter) {
      throw new BadRequestException(
        `Chapter number ${chapterOrder} already exists for this story`,
      );
    }

    const chapter = await this.chapterModel.create({
      title,
      manga_id: new Types.ObjectId(manga_id),
      price: price ?? 0,
      order: order ?? 1,
      is_published: isPublished === true,
      ai_checked: false,
      ai_verdict: null,
      risk_score: null,
      policy_version: null,
      last_content_hash: null,
    });

    const text = await this.textChapterModel.create({
      chapter_id: chapter._id,
      content,
      is_completed: is_completed ?? false,
    });

    await this.mangaModel.findByIdAndUpdate(manga_id, { updatedAt: new Date() });

    const manga = await this.mangaModel.findById(manga_id).select('authorId');
    if (manga && manga.authorId) {
      this.eventEmitter.emit('chapter_create_count', {
        userId: manga.authorId.toString(),
      });

      if (chapter.is_published) {
        this.eventEmitter.emit('chapter_published', {
          userId: manga.authorId.toString(),
        });
      }
    } else {
      console.warn('Could not find authorId for manga:', manga_id);
    }

    this.eventEmitter.emit('chapter.content_changed', {
      chapterId: chapter._id.toString(),
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

    const oldChapter = await this.chapterModel.findById(id).lean();
    if (!oldChapter) {
      throw new BadRequestException('Chapter not found');
    }

    const wasPublished = oldChapter?.is_published || false;

    if (order !== undefined && order !== oldChapter.order) {
      const existingChapter = await this.chapterModel.findOne({
        manga_id: oldChapter.manga_id,
        order: order,
        _id: { $ne: id },
      });

      if (existingChapter) {
        throw new BadRequestException(
          `Chapter number ${order} already exists for this story`,
        );
      }
    }

    const contentChanged = content !== undefined || title !== undefined;
    const nextPublished =
      isPublished !== undefined ? isPublished : wasPublished;

    if (!contentChanged && nextPublished && !wasPublished) {
      const moderation = await this.chapterModerationModel
        .findOne({ chapter_id: id })
        .select('resolution_status')
        .lean();

      if (moderation?.resolution_status === 'REJECTED') {
        throw new BadRequestException(
          'This chapter was rejected by moderation. Update the content first before publishing again.',
        );
      }
    }
    const shouldEmitPublished = nextPublished && !wasPublished;

    const chapter = await this.chapterModel.findByIdAndUpdate(
      id,
      {
        ...(title !== undefined && { title }),
        ...(price !== undefined && { price }),
        ...(order !== undefined && { order }),
        is_published: nextPublished,
        ...(contentChanged && {
          ai_checked: false,
          ai_verdict: null,
          risk_score: null,
          policy_version: null,
          last_content_hash: null,
        }),
      },
      { new: true },
    );

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

    if (contentChanged) {
      this.eventEmitter.emit('chapter.content_changed', {
        chapterId: id.toString(),
      });
    }

    // Update manga's updatedAt whenever chapter is modified
    await this.mangaModel.findByIdAndUpdate(oldChapter.manga_id, {
      updatedAt: new Date(),
    });

    if (shouldEmitPublished) {
      const manga = await this.mangaModel
        .findById(oldChapter.manga_id)
        .select('authorId')
        .lean();

      if (manga?.authorId) {
        this.eventEmitter.emit('chapter_published', {
          userId: String(manga.authorId),
        });
      }
    }

    return { chapter, text };
  }

  async deleteChapterAndText(
    id: Types.ObjectId,
  ): Promise<{ deletedChapter: any; deletedTexts: any }> {
    const deletedTexts = await this.textChapterModel.deleteMany({
      chapter_id: id,
    });

    const deletedChapter = await this.chapterModel.findByIdAndDelete(id);

    return { deletedChapter, deletedTexts };
  }
}
