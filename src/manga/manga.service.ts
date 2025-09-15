import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Manga, MangaDocument } from '../schemas/Manga.schema';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';

@Injectable()
export class MangaService {
    constructor(@InjectModel(Manga.name) private mangaModel: Model<MangaDocument>) { }


    async createManga(createMangaDto: CreateMangaDto, authorId: Types.ObjectId) {
        try {
            const newManga = new this.mangaModel({
                ...createMangaDto,
                authorId,
            });
            return await newManga.save();
        } catch {
            throw new BadRequestException('Không thể tạo manga mới');
        }
    }


    async updateManga(id: string, updateMangaDto: UpdateMangaDto, authorId: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID manga không hợp lệ');
        }

        const result = await this.mangaModel.updateOne(
            { _id: id, authorId },
            { $set: updateMangaDto }
        );

        if (result.modifiedCount === 0) {
            throw new BadRequestException('Không thể cập nhật manga hoặc manga không tồn tại');
        }

        // Trả về dữ liệu manga đã được cập nhật
        const updatedManga = await this.mangaModel.findById(id).populate('genres', 'name');
        return updatedManga;
    }


    async deleteManga(id: string, authorId: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID manga không hợp lệ');
        }

        const result = await this.mangaModel.deleteOne({ _id: id, authorId });

        if (result.deletedCount === 0) {
            throw new BadRequestException('Không thể xóa manga hoặc manga không tồn tại');
        }

        return { success: true, message: 'Xóa manga thành công' };
    }


    async getAllMangasByAuthor(authorId: Types.ObjectId) {
        const mangas = await this.mangaModel.find({ authorId }).sort({ createdAt: -1 });
        const published = mangas.filter(manga => !manga.isDraft);
        const drafts = mangas.filter(manga => manga.isDraft);
        return { published, drafts };
    }
}