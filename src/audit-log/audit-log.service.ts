import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
  AuditApprovalStatus,
  AuditActorRole,
  AuditTargetType,
} from '../schemas/AuditLog.schema';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
  ) {}

  async createLog(payload: {
    actor_id?: string;
    actor_role: AuditActorRole;
    action: string;
    target_type: AuditTargetType;
    target_id: string;
    reportCode?: string;
    summary: string;
    risk?: 'low' | 'medium' | 'high';
    before?: Record<string, any>;
    after?: Record<string, any>;
    note?: string;
    evidenceImages?: string[];
  }) {
    const doc = await this.auditModel.create({
      actor_id: payload.actor_id ? new Types.ObjectId(payload.actor_id) : undefined,
      actor_role: payload.actor_role,
      action: payload.action,
      target_type: payload.target_type,
      target_id: new Types.ObjectId(payload.target_id),
      reportCode: payload.reportCode,
      summary: payload.summary,
      risk: payload.risk ?? 'low',
      before: payload.before,
      after: payload.after,
      note: payload.note,
      evidenceImages: payload.evidenceImages ?? [],
      seen: false,
      approval: AuditApprovalStatus.PENDING,
    });

    return doc;
  }

  async findAll(query: {
    search?: string;
    role?: string;
    action?: string;
    status?: string; // unseen/seen/pending/approved
    risk?: string; // low/medium/high
    limit?: number;
    page?: number;
  }) {
    const {
      search,
      role,
      action,
      status,
      risk,
      limit = 20,
      page = 1,
    } = query;

    const filter: any = {};

    if (role && role !== 'all') filter.actor_role = role;
    if (action && action !== 'all') filter.action = action;
    if (risk && risk !== 'all') filter.risk = risk;

    if (status && status !== 'all') {
      if (status === 'unseen') filter.seen = false;
      if (status === 'seen') filter.seen = true;
      if (status === 'pending') filter.approval = AuditApprovalStatus.PENDING;
      if (status === 'approved') filter.approval = AuditApprovalStatus.APPROVED;
    }

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { summary: { $regex: s, $options: 'i' } },
        { reportCode: { $regex: s, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'actor_id', select: 'username email role' })
        .lean(),
      this.auditModel.countDocuments(filter),
    ]);

    return {
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markSeen(logId: string, adminId: string) {
    const updated = await this.auditModel.findByIdAndUpdate(
      logId,
      {
        seen: true,
        seenBy: new Types.ObjectId(adminId),
        seenAt: new Date(),
      },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Log not found');
    return updated;
  }

  async approve(logId: string, adminId: string, adminNote?: string) {
    const updated = await this.auditModel.findByIdAndUpdate(
      logId,
      {
        approval: AuditApprovalStatus.APPROVED,
        approvedBy: new Types.ObjectId(adminId),
        approvedAt: new Date(),
        ...(adminNote !== undefined ? { adminNote } : {}),
      },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Log not found');
    return updated;
  }
}
