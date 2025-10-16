import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Policies, PoliciesDocument } from '../schemas/Policies.schema';
import { CreatePoliciesDto } from './dto/create-policies.dto';
import { UpdatePoliciesDto } from './dto/update-policies.dto';
import slugify from 'slugify';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectModel(Policies.name) private readonly policiesModel: Model<PoliciesDocument>,
  ) {}

  async create(createDto: CreatePoliciesDto): Promise<Policies> {
    // ✅ Tự động sinh slug nếu FE không gửi
    if (!createDto.slug && createDto.title) {
      createDto.slug = slugify(createDto.title, { lower: true, strict: true });
    }

    const created = new this.policiesModel(createDto);
    return created.save();
  }

  async findAll(): Promise<Policies[]> {
    return this.policiesModel.find().sort({ updatedAt: -1 }).exec();
  }

  async findActive(): Promise<Policies[]> {
    return this.policiesModel.find({ status: 'Active' }).exec();
  }

  async findPublicActive(): Promise<Policies[]> {
    return this.policiesModel.find({ status: 'Active', isPublic: true }).exec();
  }

  async findById(id: string): Promise<Policies> {
    const policy = await this.policiesModel.findById(id).exec();
    if (!policy) throw new NotFoundException(`Policy with id ${id} not found`);
    return policy;
  }

  async update(id: string, updateDto: UpdatePoliciesDto): Promise<Policies> {
    const updated = await this.policiesModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Policy with id ${id} not found`);
    return updated;
  }

  async delete(id: string): Promise<Policies> {
    const deleted = await this.policiesModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Policy with id ${id} not found`);
    return deleted;
  }
}
