import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chapter, ChapterDocument } from '../schemas/chapter.schema';
import {
  TextChapter,
  TextChapterDocument,
} from '../schemas/text-chapter.schema';
import { CreateChapterWithTextDto } from './dto/create-chapter-with-text.dto';
import { UpdateChapterWithTextDto } from './dto/update-chapter-with-text.dto';
import { Types } from 'mongoose';
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

    const chapter = await this.chapterModel.create({
      title,
      manga_id: new Types.ObjectId(manga_id),
      price: price ?? 0,
      order: order ?? 1,
      is_published: isPublished ?? false,
    });
    // console.log(chapter.is_published);
    const text = await this.textChapterModel.create({
      chapter_id: chapter._id,
      content,
      is_completed: is_completed ?? false,
    });

    const manga = await this.mangaModel.findById(manga_id).select("authorId");
    if (manga && manga.authorId) {
      this.eventEmitter.emit("chapter_create_count", { userId: manga.authorId.toString() });
    } else {
      console.warn("Không tìm thấy authorId cho manga:", manga_id);
    }

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

    // update chapter first
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

    // update textChapter (if exists)
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
