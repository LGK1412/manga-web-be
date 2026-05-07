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

    // 🟢 Get all (with pagination and filtering for admin)
    async findAll(): Promise<Policies[]> {
      return this.policiesModel.find().sort({ updatedAt: -1 }).exec();
    }

    // 🟡 Get all with pagination, search, and filtering
    async findAllPaginated(query: {
      page: number;
      limit: number;
      search?: string;
      status?: string;
      visibility?: string;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
    }) {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        visibility,
        sortField = 'updatedAt',
        sortOrder = 'desc',
      } = query;

      const filter: any = {};

      // Search in title, slug, description
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Filter by status
      if (status) {
        filter.status = status;
      }

      // Filter by visibility (public/internal)
      if (visibility === 'public') {
        filter.isPublic = true;
      } else if (visibility === 'internal') {
        filter.isPublic = false;
      }

      const skip = (page - 1) * limit;

      // Build sort object
      const sort: any = {
        [sortField]: sortOrder === 'asc' ? 1 : -1,
      };

      // Fetch data and total count in parallel
      const [data, total] = await Promise.all([
        this.policiesModel
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.policiesModel.countDocuments(filter),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
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
