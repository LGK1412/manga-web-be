import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Styles, StylesDocument } from '../schemas/Styles.schema';

@Injectable()
export class StylesService {
  constructor(@InjectModel(Styles.name) private stylesModel: Model<StylesDocument>) {}

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

  async findById(id: string): Promise<Styles | null> {
    return this.stylesModel.findById(id).exec();
  }

  async update(id: string, updateStylesDto: any): Promise<Styles | null> {
    return this.stylesModel.findByIdAndUpdate(id, updateStylesDto, { new: true }).exec();
  }

  async delete(id: string): Promise<Styles | null> {
    return this.stylesModel.findByIdAndDelete(id).exec();
  }
}


