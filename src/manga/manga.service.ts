import { BadRequestException, Injectable} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Manga, MangaDocument } from '../schemas/Manga.schema';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { StylesService } from '../styles/styles.service';
import { GenreService } from '../genre/genre.service';

@Injectable()
export class MangaService {
    constructor(
        @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
        private stylesService: StylesService,
        private genreService: GenreService
    ) { }


    async createManga(createMangaDto: CreateMangaDto, authorId: Types.ObjectId) {
        try {
            // Kiểm tra styles có bị hide không
            if (createMangaDto.styles && createMangaDto.styles.length > 0) {
                for (const styleId of createMangaDto.styles) {
                    const style = await this.stylesService.findById(styleId.toString());
                    if (!style) {
                        throw new BadRequestException(`Style với ID ${styleId} không tồn tại`);
                    }
                    if (style.status === 'hide') {
                        throw new BadRequestException(`Style "${style.name}" đã bị ẩn, không thể tạo truyện với style này`);
                    }
                }
            }

            // Kiểm tra genres có bị hide không
            if (createMangaDto.genres && createMangaDto.genres.length > 0) {
                for (const genreId of createMangaDto.genres) {
                    const genre = await this.genreService.findById(genreId.toString());
                    if (!genre) {
                        throw new BadRequestException(`Genre với ID ${genreId} không tồn tại`);
                    }
                    if (genre.status === 'hide') {
                        throw new BadRequestException(`Genre "${genre.name}" đã bị ẩn, không thể tạo truyện với genre này`);
                    }
                }
            }

            const newManga = new this.mangaModel({
                ...createMangaDto,
                authorId,
            });
            return await newManga.save();
        } catch (error) {
            console.error('Error creating manga:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Không thể tạo manga mới');
        }
    }


    async updateManga(id: string, updateMangaDto: UpdateMangaDto, authorId: Types.ObjectId) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID manga không hợp lệ');
        }

        // Kiểm tra styles có bị hide không (nếu có update styles)
        if (updateMangaDto.styles && updateMangaDto.styles.length > 0) {
            for (const styleId of updateMangaDto.styles) {
                const style = await this.stylesService.findById(styleId.toString());
                if (!style) {
                    throw new BadRequestException(`Style với ID ${styleId} không tồn tại`);
                }
                if (style.status === 'hide') {
                    throw new BadRequestException(`Style "${style.name}" đã bị ẩn, không thể cập nhật truyện với style này`);
                }
            }
        }

        const result = await this.mangaModel.updateOne(
            { _id: id, authorId },
            { $set: updateMangaDto }
        );

        if (result.modifiedCount === 0) {
            throw new BadRequestException('Không thể cập nhật manga hoặc manga không tồn tại');
        }
        const updatedManga = await this.mangaModel.findById(id).populate('genres', 'name').populate('styles', 'name');
        return updatedManga;
    }


    async deleteManga(id: string, authorId: Types.ObjectId) {
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
        const mangas = await this.mangaModel
            .find({ authorId })
            .populate('genres', 'name')
            .populate('styles', 'name')
            .sort({ createdAt: -1 });

        if (!mangas || mangas.length === 0) {
            return [];
        }

        return mangas;
    }

    async toggleDelete(id: string, authorId: Types.ObjectId) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID manga không hợp lệ');
        }

        const manga = await this.mangaModel.findOne({ _id: id, authorId });
        if (!manga) {
            throw new BadRequestException('Manga không tồn tại hoặc không thuộc quyền sở hữu');
        }

        const nextDeleted = !Boolean((manga as any).isDeleted);
        await this.mangaModel.updateOne({ _id: id, authorId }, { $set: { isDeleted: nextDeleted } });

        const updated = await this.mangaModel.findById(id).populate('genres', 'name').populate('styles', 'name');
        return updated;
    }
}