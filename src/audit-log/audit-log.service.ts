import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Readable } from 'stream';
import { Comment } from '../schemas/comment.schema';
import { Reply } from '../schemas/Reply.schema';
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
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(Reply.name) private replyModel: Model<Reply>,
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
    normal: 'Normal',
    mute: 'Muted',
    ban: 'Banned',
  };

  private readonly actionLabel: Record<string, string> = {
    report_status_new: 'Report - Status set to New',
    'report_status_in-progress': 'Report - Status set to In Progress',
    report_status_resolved: 'Report - Resolved',
    report_status_rejected: 'Report - Rejected',
    report_update: 'Report - Updated',
    report_note_added: 'Report - Progress Note Added',
    report_resolution_warning_sent: 'Report - Warning Sent',
    report_resolution_user_banned: 'Report - Account Banned',
    report_resolution_user_muted: 'Report - Account Muted',
    comment_hidden: 'Comment - Hidden',
    comment_restored: 'Comment - Restored',
    reply_hidden: 'Reply - Hidden',
    reply_restored: 'Reply - Restored',
    mute_user: 'User - Muted',
    ban_user: 'User - Banned',
    admin_reset_user_status: 'User - Reset Status',
    admin_update_staff_status: 'Staff - Status Updated',
    admin_set_role: 'User - Role Updated',
  };

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

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
      const keyword = this.escapeRegex(search.trim());
      const startsWith = new RegExp(`^${keyword}`, 'i');
      const contains = new RegExp(keyword, 'i');
      filter.$or = [
        { reportCode: startsWith },
        { actor_name: startsWith },
        { actor_email: startsWith },
        { summary: contains },
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
    const [result] = await this.auditModel
      .aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unseen: {
              $sum: {
                $cond: [{ $eq: ['$seen', false] }, 1, 0],
              },
            },
            pendingApproval: {
              $sum: {
                $cond: [
                  { $eq: ['$approval', AuditApprovalStatus.PENDING] },
                  1,
                  0,
                ],
              },
            },
            highRisk: {
              $sum: {
                $cond: [{ $eq: ['$risk', 'high'] }, 1, 0],
              },
            },
          },
        },
      ])
      .exec();

    return {
      total: Number(result?.total ?? 0),
      unseen: Number(result?.unseen ?? 0),
      pendingApproval: Number(result?.pendingApproval ?? 0),
      highRisk: Number(result?.highRisk ?? 0),
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

  private firstNonEmpty(...values: unknown[]) {
    for (const value of values) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return '';
  }

  private clipText(value: unknown, limit = 96) {
    const text = String(value ?? '')
      .replace(/<img\b[^>]*>/gi, ' [emoji] ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|li|blockquote|section|article|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}...` : text;
  }

  private formatIdentity(name?: string, email?: string) {
    const safeName = String(name ?? '').trim();
    const safeEmail = String(email ?? '').trim();

    if (safeName && safeEmail) return `${safeName} (${safeEmail})`;
    if (safeName) return safeName;
    if (safeEmail) return safeEmail;
    return '';
  }

  private getTargetIdentity(log: any) {
    const before = log?.before ?? {};
    const after = log?.after ?? {};

    const username = this.firstNonEmpty(
      after.target_username,
      before.target_username,
    );
    const email = this.firstNonEmpty(after.target_email, before.target_email);

    return this.formatIdentity(username, email);
  }

  private getAuthorIdentity(log: any) {
    const before = log?.before ?? {};
    const after = log?.after ?? {};

    const authorName = this.firstNonEmpty(after.author_name, before.author_name);
    const authorEmail = this.firstNonEmpty(
      after.author_email,
      before.author_email,
    );

    return this.formatIdentity(authorName, authorEmail);
  }

  private getContentPreview(log: any) {
    const before = log?.before ?? {};
    const after = log?.after ?? {};

    return this.clipText(
      this.firstNonEmpty(after.content_preview, before.content_preview),
      110,
    );
  }

  private buildStatusTransition(log: any) {
    const beforeStatus = log?.before?.status;
    const afterStatus = log?.after?.status;

    if (beforeStatus === undefined && afterStatus === undefined) return '';

    const left =
      beforeStatus !== undefined ? this.prettyStatus(beforeStatus) : '-';
    const right =
      afterStatus !== undefined ? this.prettyStatus(afterStatus) : '-';
    return `${left} -> ${right}`;
  }

  private buildRoleTransition(log: any) {
    const beforeRole = log?.before?.role;
    const afterRole = log?.after?.role;

    if (beforeRole === undefined && afterRole === undefined) return '';

    const left = beforeRole !== undefined ? this.prettyRole(beforeRole) : '-';
    const right = afterRole !== undefined ? this.prettyRole(afterRole) : '-';
    return `${left} -> ${right}`;
  }

  private buildHumanMessage(log: any) {
    const action = String(log?.action || '').trim().toLowerCase();
    const targetId = this.firstNonEmpty(log?.target_id, log?.targetId);
    const raw = String(log?.summary || '')
      .replaceAll('report_status_', '')
      .replaceAll('_', ' ')
      .trim();
    const targetIdentity = this.getTargetIdentity(log);
    const authorIdentity = this.getAuthorIdentity(log);
    const contentPreview = this.getContentPreview(log);
    const statusTransition = this.buildStatusTransition(log);
    const roleTransition = this.buildRoleTransition(log);

    switch (action) {
      case 'ban_user':
      case 'mute_user':
      case 'admin_reset_user_status':
      case 'admin_update_staff_status':
      case 'admin_set_role':
        return raw || (targetIdentity ? `${this.prettyAction(action)}: ${targetIdentity}` : this.prettyAction(action));
      case 'comment_hidden':
        if (contentPreview && authorIdentity) {
          return `Comment hidden for ${authorIdentity}: "${contentPreview}"`;
        }
        if (contentPreview) return `Comment hidden: "${contentPreview}"`;
        if (targetId) return `Comment hidden (record ${targetId})`;
        return raw || 'Comment hidden';
      case 'comment_restored':
        if (contentPreview && authorIdentity) {
          return `Comment restored for ${authorIdentity}: "${contentPreview}"`;
        }
        if (contentPreview) return `Comment restored: "${contentPreview}"`;
        if (targetId) return `Comment restored (record ${targetId})`;
        return raw || 'Comment restored';
      case 'reply_hidden':
        if (contentPreview && authorIdentity) {
          return `Reply hidden for ${authorIdentity}: "${contentPreview}"`;
        }
        if (contentPreview) return `Reply hidden: "${contentPreview}"`;
        if (targetId) return `Reply hidden (record ${targetId})`;
        return raw || 'Reply hidden';
      case 'reply_restored':
        if (contentPreview && authorIdentity) {
          return `Reply restored for ${authorIdentity}: "${contentPreview}"`;
        }
        if (contentPreview) return `Reply restored: "${contentPreview}"`;
        if (targetId) return `Reply restored (record ${targetId})`;
        return raw || 'Reply restored';
    }

    if (statusTransition) return `Updated status: ${statusTransition}`;
    if (roleTransition) return `Updated role: ${roleTransition}`;
    if (!raw) return '-';

    return raw;
  }

  private needsTargetContext(log: any) {
    const targetType = String(log?.target_type || '').toLowerCase();
    const action = String(log?.action || '').toLowerCase();
    const isCommentLike =
      targetType === 'comment' ||
      targetType === 'reply' ||
      action.startsWith('comment_') ||
      action.startsWith('reply_');

    if (!isCommentLike) return false;

    return !this.firstNonEmpty(
      log?.after?.content_preview,
      log?.before?.content_preview,
      log?.after?.author_name,
      log?.before?.author_name,
    );
  }

  private applyTargetContext(log: any, context?: {
    author_name?: string;
    author_email?: string;
    content_preview?: string;
    content_html?: string;
  }) {
    if (!context) return log;

    const before = { ...(log?.before ?? {}) };
    const after = { ...(log?.after ?? {}) };

    if (context.author_name) {
      before.author_name = before.author_name ?? context.author_name;
      after.author_name = after.author_name ?? context.author_name;
    }

    if (context.author_email) {
      before.author_email = before.author_email ?? context.author_email;
      after.author_email = after.author_email ?? context.author_email;
    }

    if (context.content_preview) {
      before.content_preview = before.content_preview ?? context.content_preview;
      after.content_preview = after.content_preview ?? context.content_preview;
    }

    if (context.content_html) {
      before.content_html = before.content_html ?? context.content_html;
      after.content_html = after.content_html ?? context.content_html;
    }

    return {
      ...log,
      before,
      after,
    };
  }

  private async enrichTargetContext(logs: any[]) {
    type TargetContext = {
      author_name?: string;
      author_email?: string;
      content_preview?: string;
      content_html?: string;
    };
    const commentIds = new Set<string>();
    const replyIds = new Set<string>();

    for (const log of logs) {
      if (!this.needsTargetContext(log)) continue;

      const targetId = String(log?.target_id || '').trim();
      if (!Types.ObjectId.isValid(targetId)) continue;

      const targetType = String(log?.target_type || '').toLowerCase();
      if (targetType === 'comment') commentIds.add(targetId);
      if (targetType === 'reply') replyIds.add(targetId);
    }

    const [comments, replies] = await Promise.all([
      commentIds.size
        ? this.commentModel
            .find({ _id: { $in: Array.from(commentIds, (id) => new Types.ObjectId(id)) } })
            .select('content user_id')
            .populate({ path: 'user_id', select: 'username email' })
            .lean()
        : Promise.resolve([]),
      replyIds.size
        ? this.replyModel
            .find({ _id: { $in: Array.from(replyIds, (id) => new Types.ObjectId(id)) } })
            .select('content user_id')
            .populate({ path: 'user_id', select: 'username email' })
            .lean()
        : Promise.resolve([]),
    ]);

    const commentContext = new Map<string, TargetContext>();
    for (const item of comments as any[]) {
      commentContext.set(String(item?._id), {
        author_name: item?.user_id?.username,
        author_email: item?.user_id?.email,
        content_preview: this.clipText(item?.content, 110),
        content_html: String(item?.content ?? '').trim() || undefined,
      });
    }

    const replyContext = new Map<string, TargetContext>();
    for (const item of replies as any[]) {
      replyContext.set(String(item?._id), {
        author_name: item?.user_id?.username,
        author_email: item?.user_id?.email,
        content_preview: this.clipText(item?.content, 110),
        content_html: String(item?.content ?? '').trim() || undefined,
      });
    }

    return logs.map((log) => {
      if (!this.needsTargetContext(log)) return log;

      const targetId = String(log?.target_id || '').trim();
      const targetType = String(log?.target_type || '').toLowerCase();
      const context =
        targetType === 'comment'
          ? commentContext.get(targetId)
          : targetType === 'reply'
            ? replyContext.get(targetId)
            : undefined;

      return this.applyTargetContext(log, context);
    });
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

  private buildCsvRow(row: any) {
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
  }

  private async *createCsvChunks(filter: any) {
    yield '\uFEFF' + this.exportHeaders.join(',') + '\n';

    const cursor = this.auditModel
      .find(filter)
      .sort({ createdAt: -1 })
      .select(
        'createdAt actor_name actor_email actor_role action summary risk seen approval before after reportCode',
      )
      .lean()
      .cursor();

    try {
      for await (const row of cursor) {
        yield this.buildCsvRow(row) + '\n';
      }
    } finally {
      if (typeof cursor.close === 'function') {
        await cursor.close();
      }
    }
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

    const [rawRows, summary] = await Promise.all([
      this.findRows(filter, safeLimit, safePage),
      this.buildSummary(filter),
    ]);
    const rows = await this.enrichTargetContext(rawRows);

    return {
      rows,
      total: summary.total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(summary.total / safeLimit)),
      summary,
    };
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
    const filter = this.buildFilter(query);
    const createdAt = new Date().toISOString().slice(0, 10);

    return {
      filename: `audit-logs-${createdAt}.csv`,
      stream: Readable.from(this.createCsvChunks(filter)),
    };
  }

  async findOne(id: string) {
    const doc = await this.auditModel
      .findById(id)
      .populate({ path: 'actor_id', select: 'username email role avatar' })
      .lean();

    if (!doc) throw new NotFoundException('Log not found');
    const [enrichedDoc] = await this.enrichTargetContext([doc]);
    return enrichedDoc;
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

    return this.enrichTargetContext(rows);
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

  async markAllSeen(
    adminId: string,
    query?: {
      search?: string;
      role?: string;
      action?: string;
      status?: string;
      risk?: string;
      dateRange?: string;
      from?: string;
      to?: string;
    },
  ) {
    const filter = {
      ...this.buildFilter(query ?? {}),
      seen: false,
    };
    const res = await this.auditModel.updateMany(
      filter,
      {
        seen: true,
        seenBy: new Types.ObjectId(adminId),
        seenAt: new Date(),
      },
    );

    return { updated: res.modifiedCount };
  }
}
