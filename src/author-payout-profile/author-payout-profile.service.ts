import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';

import { AuthorPayoutProfileDocument } from 'src/schemas/author-payout-profile.schema';
import { AuthorPayoutProfileHistoryDocument } from 'src/schemas/author-payout-profile-history.schema';
import { CreateAuthorPayoutProfileDto } from './dto/create-profile.dto';
import { AdminListProfileQueryDto } from './dto/admin-list-query.dto';

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export interface ProfileItem {
  _id: string;

  fullName: string;
  citizenId: string;
  dateOfBirth: Date;
  address: string;
  taxCode: string;

  bankName: string;
  bankAccount: string;
  bankAccountName: string;

  identityImages?: string[];

  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: Date;

  userId: {
    _id: string;
    email?: string;
    username?: string;
  };
}

export interface AdminProfileListResult {
  items: ProfileItem[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class AuthorPayoutProfileService {
  constructor(
    @InjectModel('AuthorPayoutProfile')
    private profileModel: Model<AuthorPayoutProfileDocument>,

    @InjectModel('AuthorPayoutProfileHistory')
    private historyModel: Model<AuthorPayoutProfileHistoryDocument>,
  ) { }

  async getProfile(userId: string) {
    const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'email username');

    if (!profile) {
      return { kycStatus: 'not_found', isActive: false };
    }

    return {
      kycStatus: profile.kycStatus,
      isActive: profile.isActive,
      profile,
    };
  }

  async createInitialProfile(userId: string, data: CreateAuthorPayoutProfileDto) {
    const existed = await this.profileModel.exists({ userId });
    if (existed) {
      throw new BadRequestException('Profile already exists. Use update method instead.');
    }

    const newProfile = new this.profileModel({
      ...data,
      userId: new Types.ObjectId(userId),
      kycStatus: KycStatus.PENDING,
      isActive: false,
    });

    return await newProfile.save();
  }

  async updateProfile(userId: string, data: CreateAuthorPayoutProfileDto) {
    const currentProfile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) });

    if (!currentProfile) {
      throw new NotFoundException('Profile không tồn tại.');
    }

    const historyEntry = new this.historyModel({
      ...currentProfile.toObject(),
      _id: new Types.ObjectId(),
      changedAt: new Date(),
      changedBy: new Types.ObjectId(userId),
      changeReason: 'User updated profile',
    });
    await historyEntry.save();

    return await this.profileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        ...data,
        kycStatus: KycStatus.PENDING,
        isActive: false,
        rejectReason: '',
      },
      { new: true }
    );
  }

  async approveProfile(profileId: string, adminId: string) {
    const profile = await this.profileModel.findByIdAndUpdate(
      profileId,
      {
        kycStatus: KycStatus.VERIFIED,
        isActive: true,
        verifiedBy: new Types.ObjectId(adminId),
        verifiedAt: new Date(),
        rejectReason: '',
      },
      { new: true }
    );

    if (!profile) throw new NotFoundException('Không tìm thấy profile.');
    return profile;
  }

  async rejectProfile(profileId: string, adminId: string, reason: string) {
    const profile = await this.profileModel.findByIdAndUpdate(
      profileId,
      {
        kycStatus: KycStatus.REJECTED,
        isActive: false,
        verifiedBy: new Types.ObjectId(adminId),
        verifiedAt: new Date(),
        rejectReason: reason,
      },
      { new: true }
    );

    if (!profile) throw new NotFoundException('Không tìm thấy profile.');
    return profile;
  }

  async adminGetProfiles(query: AdminListProfileQueryDto) {
    const { kycStatus, keyword, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const searchMatch: any = {};
    if (keyword) {
      searchMatch.$or = [
        { fullName: { $regex: keyword, $options: 'i' } },
        { citizenId: { $regex: keyword, $options: 'i' } },
      ];
    }


    const kycMatch: any = {};
    if (kycStatus) {
      kycMatch.kycStatus = kycStatus;
    }

    const pipeline: PipelineStage[] = [
      { $match: { ...searchMatch, ...kycMatch } },

      {
        $unionWith: {
          coll: 'authorpayoutprofilehistories',
          pipeline: [
            { $match: { ...searchMatch, ...kycMatch } },
            { $addFields: { isHistory: true } }
          ],
        },
      },

      {
        $addFields: {
          sortDate: { $ifNull: ['$changedAt', '$createdAt'] },
        },
      },
      { $sort: { sortDate: -1 } },

      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user_info',
              },
            },
            { $unwind: { path: '$user_info', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                'user_info.password': 0,
                'user_info.salt': 0,
                sortDate: 0,
              },
            },
          ],
        },
      },
    ];

    const result = await this.profileModel.aggregate(pipeline);

    const items = result[0]?.data || [];
    const total = result[0]?.metadata[0]?.total || 0;

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}