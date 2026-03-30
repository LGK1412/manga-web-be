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

  private readonly exportHeaders = [
    'Time',
    'Actor',
    'Email',
    'Role',
    'Action',
    'Message',
    'Risk',
    'Seen',
    'Approval',
  ];

  private readonly roleLabel: Record<string, string> = {
    admin: 'Admin',
    community_manager: 'Community Manager',
    content_moderator: 'Content Moderator',
    system: 'System',
  };

  private readonly statusLabel: Record<string, string> = {
    new: 'New',
    'in-progress': 'In Progress',
    resolved: 'Resolved',
    rejected: 'Rejected',
  };

  private readonly actionLabel: Record<string, string> = {
    report_status_new: 'Report - Status set to New',
    'report_status_in-progress': 'Report - Status set to In Progress',
    report_status_resolved: 'Report - Resolved',
    report_status_rejected: 'Report - Rejected',
    report_update: 'Report - Updated',
    comment_hidden: 'Comment - Hidden',
    comment_restored: 'Comment - Restored',
    reply_hidden: 'Reply - Hidden',
    reply_restored: 'Reply - Restored',
  };

  private buildFilter(query: {
    search?: string;
    role?: string;
    action?: string;
    status?: string;
    risk?: string;
    dateRange?: string;
    from?: string;
    to?: string;
  }) {
    const {
      search,
      role,
      action,
      status,
      risk,
      dateRange,
      from,
      to,
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
      const keyword = search.trim();
      filter.$or = [
        { summary: { $regex: keyword, $options: 'i' } },
        { reportCode: { $regex: keyword, $options: 'i' } },
        { actor_name: { $regex: keyword, $options: 'i' } },
        { actor_email: { $regex: keyword, $options: 'i' } },
      ];
    }

    const createdAt = this.resolveCreatedAtFilter(dateRange, from, to);
    if (createdAt) filter.createdAt = createdAt;

    return filter;
  }

  private resolveCreatedAtFilter(
    dateRange?: string,
    from?: string,
    to?: string,
  ) {
    const normalizedRange = String(dateRange || 'all').trim().toLowerCase();
    const now = new Date();

    const startOfDay = (value: Date) => {
      const cloned = new Date(value);
      cloned.setHours(0, 0, 0, 0);
      return cloned;
    };

    const endOfDay = (value: Date) => {
      const cloned = new Date(value);
      cloned.setHours(23, 59, 59, 999);
      return cloned;
    };

    if (normalizedRange === 'today') {
      return {
        $gte: startOfDay(now),
        $lte: endOfDay(now),
      };
    }

    if (normalizedRange === '7days' || normalizedRange === '30days') {
      const daysBack = normalizedRange === '7days' ? 6 : 29;
      const start = startOfDay(now);
      start.setDate(start.getDate() - daysBack);
      return {
        $gte: start,
        $lte: endOfDay(now),
      };
    }

    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    const hasFrom = parsedFrom && !Number.isNaN(parsedFrom.getTime());
    const hasTo = parsedTo && !Number.isNaN(parsedTo.getTime());

    if (hasFrom || hasTo) {
      const createdAt: Record<string, Date> = {};
      if (hasFrom) createdAt.$gte = startOfDay(parsedFrom!);
      if (hasTo) createdAt.$lte = endOfDay(parsedTo!);
      return createdAt;
    }

    return undefined;
  }

  private async findRows(filter: any, limit?: number, page?: number) {
    const query = this.auditModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'actor_id', select: 'username email role avatar' })
      .lean();

    if (typeof limit === 'number' && typeof page === 'number') {
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      const safePage = Math.max(page, 1);
      query.skip((safePage - 1) * safeLimit).limit(safeLimit);
    }

    return query;
  }

  private async buildSummary(filter: any) {
    const [total, unseen, pendingApproval, highRisk] = await Promise.all([
      this.auditModel.countDocuments(filter),
      this.auditModel.countDocuments({ ...filter, seen: false }),
      this.auditModel.countDocuments({
        ...filter,
        approval: AuditApprovalStatus.PENDING,
      }),
      this.auditModel.countDocuments({ ...filter, risk: 'high' }),
    ]);

    return {
      total,
      unseen,
      pendingApproval,
      highRisk,
    };
  }

  private titleize(value: string) {
    return String(value || '')
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(' ');
  }

  private prettyRole(role?: string) {
    const key = String(role || '').toLowerCase();
    return this.roleLabel[key] ?? this.titleize(key || 'system');
  }

  private prettyStatus(status?: string) {
    const key = String(status || '').toLowerCase();
    return this.statusLabel[key] ?? this.titleize(key);
  }

  private prettyAction(action?: string) {
    const key = String(action || '');
    return this.actionLabel[key] ?? this.titleize(key);
  }

  private buildHumanMessage(log: any) {
    const action = String(log?.action || '').trim().toLowerCase();
    const beforeStatus = log?.before?.status;
    const afterStatus = log?.after?.status;

    if (beforeStatus !== undefined || afterStatus !== undefined) {
      const left = beforeStatus ? this.prettyStatus(beforeStatus) : '-';
      const right = afterStatus ? this.prettyStatus(afterStatus) : '-';
      return `Updated status: ${left} -> ${right}`;
    }

    switch (action) {
      case 'comment_hidden':
        return 'Comment hidden';
      case 'comment_restored':
        return 'Comment restored';
      case 'reply_hidden':
        return 'Reply hidden';
      case 'reply_restored':
        return 'Reply restored';
    }

    const raw = String(log?.summary || '');
    if (!raw) return '-';

    return raw.replaceAll('report_status_', '').replaceAll('_', ' ').trim();
  }

  private escapeCsvCell(value: unknown) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private formatCsvTime(value?: Date | string) {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
  }

  private buildCsv(rows: any[]) {
    const lines = rows.map((row) => {
      const actorName =
        row?.actor_id?.username || row?.actor_name || row?.actorUsername || 'Unknown';
      const actorEmail =
        row?.actor_id?.email || row?.actor_email || row?.actorEmail || 'No email';
      const actorRole = row?.actor_role || row?.actor_id?.role || 'system';

      return [
        this.formatCsvTime(row?.createdAt),
        actorName,
        actorEmail,
        this.prettyRole(actorRole),
        this.prettyAction(row?.action),
        this.buildHumanMessage(row),
        row?.risk ?? 'low',
        row?.seen ? 'Yes' : 'No',
        row?.approval ?? AuditApprovalStatus.PENDING,
      ]
        .map((cell) => this.escapeCsvCell(cell))
        .join(',');
    });

    return ['\uFEFF' + this.exportHeaders.join(','), ...lines].join('\n');
  }

  async createLog(payload: {
    actor_id?: string;
    actor_name?: string;
    actor_email?: string;
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
      actor_name: payload.actor_name,
      actor_email: payload.actor_email,
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
    status?: string;
    risk?: string;
    dateRange?: string;
    from?: string;
    to?: string;
    limit?: number;
    page?: number;
  }) {
    const { limit = 20, page = 1 } = query;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const filter = this.buildFilter(query);

    const [rows, summary] = await Promise.all([
      this.findRows(filter, safeLimit, safePage),
      this.buildSummary(filter),
    ]);

    return {
      rows,
      total: summary.total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(summary.total / safeLimit)),
      summary,
    };
  }

  async findForExport(query: {
    search?: string;
    role?: string;
    action?: string;
    status?: string;
    risk?: string;
    dateRange?: string;
    from?: string;
    to?: string;
  }) {
    const filter = this.buildFilter(query);
    return this.findRows(filter);
  }

  async exportCsv(query: {
    search?: string;
    role?: string;
    action?: string;
    status?: string;
    risk?: string;
    dateRange?: string;
    from?: string;
    to?: string;
  }) {
    const rows = await this.findForExport(query);
    const createdAt = new Date().toISOString().slice(0, 10);

    return {
      filename: `audit-logs-${createdAt}.csv`,
      content: this.buildCsv(rows),
    };
  }

  async findOne(id: string) {
    const doc = await this.auditModel
      .findById(id)
      .populate({ path: 'actor_id', select: 'username email role avatar' })
      .lean();

    if (!doc) throw new NotFoundException('Log not found');
    return doc;
  }

  async findByTarget(
    targetType: AuditTargetType,
    targetId: string,
    limit = 20,
  ) {
    const rows = await this.auditModel
      .find({
        target_type: targetType,
        target_id: new Types.ObjectId(targetId),
      })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .populate({ path: 'actor_id', select: 'username email role avatar' })
      .lean();

    return rows;
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

  async markAllSeen(adminId: string) {
    const res = await this.auditModel.updateMany(
      { seen: false },
      {
        seen: true,
        seenBy: new Types.ObjectId(adminId),
        seenAt: new Date(),
      },
    );

    return { updated: res.modifiedCount };
  }
}
