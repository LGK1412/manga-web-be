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
      @InjectModel(Policies.name)
      private readonly policiesModel: Model<PoliciesDocument>,
    ) {}

    // 🟢 Create
    async create(createDto: CreatePoliciesDto): Promise<Policies> {
      if (!createDto.slug && createDto.title) {
        createDto.slug = slugify(createDto.title, { lower: true, strict: true });
      }

      const created = new this.policiesModel(createDto);
      return created.save();
    }

    // 🟢 Get all
    async findAll(): Promise<Policies[]> {
      return this.policiesModel.find().sort({ updatedAt: -1 }).exec();
    }

    // 🟡 Get by mainType (e.g. TERMS, PRIVACY)
    async findByMainType(mainType: string): Promise<Policies[]> {
      return this.policiesModel
        .find({
          mainType: mainType.toUpperCase(),
          status: 'Active',
          isPublic: true,
        })
        .sort({ updatedAt: -1 })
        .exec();
    }

    // 🟢 Active policies
    async findActive(): Promise<Policies[]> {
      return this.policiesModel.find({ status: 'Active' }).exec();
    }

    // 🟢 Public + active policies
    async findPublicActive(): Promise<Policies[]> {
      return this.policiesModel.find({ status: 'Active', isPublic: true }).exec();
    }

    // 🟡 Find by ID
    async findById(id: string): Promise<Policies> {
      const policy = await this.policiesModel.findById(id).exec();
      if (!policy) throw new NotFoundException(`Policy with id ${id} not found`);
      return policy;
    }

    // 🟢 Update
    async update(id: string, updateDto: UpdatePoliciesDto): Promise<Policies> {
      const updated = await this.policiesModel
        .findByIdAndUpdate(id, updateDto, { new: true })
        .exec();
      if (!updated) throw new NotFoundException(`Policy with id ${id} not found`);
      return updated;
    }

    // 🔴 Delete
    async delete(id: string): Promise<Policies> {
      const deleted = await this.policiesModel.findByIdAndDelete(id).exec();
      if (!deleted) throw new NotFoundException(`Policy with id ${id} not found`);
      return deleted;
    }
  }
