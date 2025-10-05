import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chapter } from 'src/schemas/chapter.schema';

@Injectable()
export class ChapterServiceOnlyNormalChapterInfor {
    constructor(@InjectModel(Chapter.name) private chapterModel: Model<Chapter>) { }

    async getChapterById(id) {
        return this.chapterModel.findById(id).populate({ path: "manga_id", populate: { path: "authorId" } }).lean();
    }
}
