import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Styles, StylesDocument } from '../schemas/Styles.schema';
import { Manga, MangaDocument } from '../schemas/Manga.schema';
import { CreateStyleDto } from './dto/CreateStyle.Schema';
import { UpdateStyleDto } from './dto/UpdateStyle.Schema';

@Injectable()
export class StylesService {
  constructor(
    @InjectModel(Styles.name) private styleModel: Model<StylesDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
  ) {}

  /**
   * Lấy tất cả styles kèm số lượng manga (storiesCount)
   */
  async findAll(): Promise<any[]> {
    const styles = await this.styleModel.find().sort({ name: 1 }).lean();

    const counts = await this.mangaModel.aggregate([
      { $unwind: '$styles' },
      { $group: { _id: '$styles', count: { $sum: 1 } } },
    ]);

    return styles.map((style) => {
      const found = counts.find(
        (c) => c._id.toString() === (style._id as Types.ObjectId).toString(),
      );
      return {
        ...style,
        storiesCount: found ? found.count : 0,
      };
    });
  }

  async findOne(id: string): Promise<Styles> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    const style = await this.styleModel.findById(id).exec();
    if (!style) throw new NotFoundException('Style not found');
    return style;
  }

  async create(dto: CreateStyleDto): Promise<Styles> {
    const newStyle = new this.styleModel(dto);
    return newStyle.save();
  }

  async update(id: string, dto: UpdateStyleDto): Promise<Styles> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    const updated = await this.styleModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Style not found');
    return updated;
  }

  async remove(id: string): Promise<Styles> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    const deleted = await this.styleModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Style not found');
    return deleted;
  }
}
