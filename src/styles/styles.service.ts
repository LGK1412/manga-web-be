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