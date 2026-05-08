import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Styles, StylesDocument } from '../schemas/Styles.schema';

@Injectable()
export class StylesService {
  constructor(
    @InjectModel(Styles.name)
    private readonly stylesModel: Model<StylesDocument>,
  ) {}

  async create(createStylesDto: any): Promise<Styles> {
    const createdStyles = new this.stylesModel(createStylesDto);
    return createdStyles.save();
  }

  async findAll(): Promise<Styles[]> {
    return this.stylesModel.find().exec();
  }

  async findAllPaginated(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);
    const skip = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const status = String(query.status || '').trim();
    const sortDir = query.sortDir === 'asc' ? 1 : -1;
    const sortBy = query.sortBy || 'updatedAt';

    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const sort: Record<string, 1 | -1> =
      sortBy === 'name'
        ? { name: sortDir, _id: 1 }
        : { updatedAt: sortDir, _id: 1 };

    const [items, total] = await Promise.all([
      this.stylesModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.stylesModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findActive(): Promise<Styles[]> {
    return this.stylesModel.find({ status: 'normal' }).exec();
  }

  async findById(id: string): Promise<Styles> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid style id');
    }

    const style = await this.stylesModel.findById(id).exec();

    if (!style) {
      throw new NotFoundException('Style not found');
    }

    return style;
  }

  async update(id: string, updateStylesDto: any): Promise<Styles> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid style id');
    }

    const updated = await this.stylesModel
      .findByIdAndUpdate(id, updateStylesDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Style not found');
    }

    return updated;
  }

  async delete(id: string): Promise<Styles> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid style id');
    }

    const deleted = await this.stylesModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException('Style not found');
    }

    return deleted;
  }
}