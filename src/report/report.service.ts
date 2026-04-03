import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import {
  Report,
  ReportDocument,
  ReportTimelineEntry,
} from '../schemas/Report.schema'
import { User } from '../schemas/User.schema'
import { Manga } from '../schemas/Manga.schema'
import { Chapter } from '../schemas/chapter.schema'
import { Comment } from '../schemas/comment.schema'
import { Reply } from '../schemas/Reply.schema'

import { AuditLogService } from '../audit-log/audit-log.service'
import { AuditActorRole, AuditTargetType } from '../schemas/AuditLog.schema'
import { NotificationService } from '../notification/notification.service'
import { UserService } from '../user/user.service'
import { Role } from 'src/common/enums/role.enum'
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface'

type ReportStatus = 'new' | 'in-progress' | 'resolved' | 'rejected'
type ReportResolutionAction = 'none' | 'warning_sent' | 'user_banned' | 'user_muted'
type TimelineType =
  | 'report_created'
  | 'note_added'
  | 'status_changed'
  | 'warning_sent'
  | 'user_banned'
  | 'user_muted'
  | 'report_rejected'

export interface MangaTarget {
  _id: Types.ObjectId
  title: string
  authorId: Types.ObjectId
  isPublish?: boolean
  isDeleted?: boolean
  status?: string
}

export interface ChapterTarget {
  _id: Types.ObjectId
  manga_id: Types.ObjectId
  title?: string
  chapter_number?: number
  content?: string
  authorId?: Types.ObjectId
  isPublish?: boolean
  isDeleted?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface CommentTarget {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  content: string
}

export interface ReplyTarget {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  content: string
  comment_id?: Types.ObjectId
}

interface TargetContext {
  targetType: 'Manga' | 'Chapter' | 'Comment' | 'Reply'
  targetId: Types.ObjectId
  targetLabel: string
  ownerUserId: Types.ObjectId | null
}

interface StaffSnapshot {
  actorId: string
  actorName?: string
  actorEmail?: string
  actorRole?: string
}

export interface ReportWithTargetDetail {
  _id: Types.ObjectId
  reporter_id: {
    _id?: Types.ObjectId
    username: string
    email: string
    role: string
    avatar?: string
  }
  target_type: string
  target_id: MangaTarget | ChapterTarget | CommentTarget | ReplyTarget
  reason: string
  description?: string
  status: ReportStatus
  createdAt: Date
  updatedAt: Date
  reportCode: string
  id: string
  assignee_id?: Types.ObjectId | null
  picked_at?: Date | null
  resolver_id?: Types.ObjectId | null
  resolved_at?: Date | null
  resolution_action?: ReportResolutionAction
  resolution_note?: string
  timeline?: ReportTimelineEntry[]
  target_detail?: {
    title?: string | null
    content?: string | null
    target_human?: {
      user_id: Types.ObjectId | null
      username: string
      email: string
      avatar?: string
    } | null
  }
  assignee_detail?: {
    user_id: Types.ObjectId
    username: string
    email: string
    role?: string
    avatar?: string
  } | null
  allowed_resolution_actions?: ReportResolutionAction[]
}

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Manga.name) private mangaModel: Model<Manga>,
    @InjectModel(Chapter.name) private chapterModel: Model<Chapter>,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(Reply.name) private replyModel: Model<Reply>,
    private readonly audit: AuditLogService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  private normalizeRole(role?: string) {
    return String(role || '').trim().toLowerCase()
  }

  private allowedTargetTypesByRole(role?: string): string[] | null {
    const r = this.normalizeRole(role)

    if (r === Role.ADMIN) return null
    if (r === Role.CONTENT_MODERATOR) return ['Manga', 'Chapter']
    if (r === Role.COMMUNITY_MANAGER) return ['Comment', 'Reply']
    return []
  }

  private allowedResolutionActionsByRole(
    role?: string,
    targetType?: string,
  ): ReportResolutionAction[] {
    const r = this.normalizeRole(role)

    if (!targetType) return ['none']
    if (r === Role.ADMIN) return ['none', 'warning_sent']
    if (r === Role.CONTENT_MODERATOR && ['Manga', 'Chapter'].includes(targetType)) {
      return ['none', 'warning_sent', 'user_banned']
    }
    if (r === Role.COMMUNITY_MANAGER && ['Comment', 'Reply'].includes(targetType)) {
      return ['none', 'warning_sent', 'user_muted']
    }
    return ['none']
  }

  private ensureCanAccessReport(role: string | undefined, targetType: string) {
    const allow = this.allowedTargetTypesByRole(role)
    if (allow === null) return
    if (!allow.includes(targetType)) {
      throw new ForbiddenException('Permission denied for this report target type')
    }
  }

  private ensureResolutionActionAllowed(
    role: string | undefined,
    targetType: string,
    action: ReportResolutionAction,
  ) {
    if (action === 'none') return

    const allowed = this.allowedResolutionActionsByRole(role, targetType)
    if (!allowed.includes(action)) {
      throw new ForbiddenException('Permission denied for this report action')
    }
  }

  private getUserId(payload: any): string | undefined {
    return payload?.userId || payload?.user_id || payload?.user_id?.toString?.()
  }

  private getUsername(payload: any): string | undefined {
    return payload?.username || payload?.name || payload?.user_name
  }

  private getEmail(payload: any): string | undefined {
    return payload?.email || payload?.user_email
  }

  private requireActorId(payload: any): string {
    const actorId = this.getUserId(payload)
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid user context')
    }
    return actorId
  }

  private mapAuditActorRole(appRole?: string): AuditActorRole {
    const r = this.normalizeRole(appRole)
    if (r === Role.ADMIN) return AuditActorRole.ADMIN
    if (r === Role.CONTENT_MODERATOR) return AuditActorRole.CONTENT_MODERATOR
    if (r === Role.COMMUNITY_MANAGER) return AuditActorRole.COMMUNITY_MANAGER
    return AuditActorRole.SYSTEM
  }

  private computeReportCode(reportId: any): string {
    const idStr = String(reportId)
    return 'RPT-' + idStr.slice(-6).toUpperCase()
  }

  private normalizeNote(input?: string | null) {
    const normalized = String(input || '').trim()
    return normalized || undefined
  }

  private toObjectId(id: string | Types.ObjectId) {
    if (id instanceof Types.ObjectId) return id
    return new Types.ObjectId(String(id))
  }

  private toObjectIdString(value: unknown) {
    if (!value) return ''
    if (value instanceof Types.ObjectId) return value.toString()
    if (typeof value === 'object' && value !== null && '_id' in (value as any)) {
      const nested = (value as any)._id
      return nested?.toString?.() || String(nested || '')
    }
    return String(value)
  }

  private formatStatusLabel(status?: string) {
    switch (status) {
      case 'new':
        return 'New'
      case 'in-progress':
        return 'In Progress'
      case 'resolved':
        return 'Resolved'
      case 'rejected':
        return 'Rejected'
      default:
        return status || 'Unknown'
    }
  }

  private buildTimelineEntry(args: {
    type: TimelineType
    message: string
    payload?: JwtPayload | StaffSnapshot | null
    createdAt?: Date
    meta?: Record<string, any> | null
  }): ReportTimelineEntry {
    const payload = args.payload || null
    const actorId =
      payload && 'actorId' in payload
        ? payload.actorId
        : this.getUserId(payload as any)

    return {
      actor_id:
        actorId && Types.ObjectId.isValid(actorId)
          ? new Types.ObjectId(actorId)
          : null,
      actor_name:
        payload && 'actorName' in payload
          ? payload.actorName || ''
          : this.getUsername(payload as any) || '',
      actor_email:
        payload && 'actorEmail' in payload
          ? payload.actorEmail || ''
          : this.getEmail(payload as any) || '',
      actor_role:
        payload && 'actorRole' in payload
          ? payload.actorRole || ''
          : this.normalizeRole((payload as any)?.role),
      type: args.type,
      message: args.message,
      meta: args.meta || null,
      createdAt: args.createdAt || new Date(),
    }
  }

  private getRisk(reason?: string): 'low' | 'medium' | 'high' {
    if (reason === 'Harassment' || reason === 'Inappropriate') return 'high'
    if (reason === 'Copyright') return 'medium'
    return 'low'
  }

  private ensureStatusTransition(
    currentStatus: ReportStatus,
    nextStatus?: ReportStatus,
  ) {
    if (!nextStatus || nextStatus === currentStatus) return

    if (currentStatus === 'new' && nextStatus !== 'in-progress') {
      throw new BadRequestException(
        'A new report must move to in-progress before it can be closed.',
      )
    }

    if (currentStatus === 'in-progress') {
      if (!['resolved', 'rejected'].includes(nextStatus)) {
        throw new BadRequestException('Invalid report status transition.')
      }
      return
    }

    if (currentStatus === 'resolved' || currentStatus === 'rejected') {
      throw new BadRequestException('Closed reports cannot change status.')
    }
  }

  private ensureCanHandleAssignment(
    report: any,
    actorId: string,
    actorRole?: string,
  ) {
    if (!report?.assignee_id) return
    if (this.toObjectIdString(report.assignee_id) === actorId) return
    if (this.normalizeRole(actorRole) === Role.ADMIN) return

    throw new ForbiddenException('This report is already assigned to another staff member.')
  }

  private getSeedTimeline(beforeDoc: any) {
    const timeline = Array.isArray(beforeDoc?.timeline) ? [...beforeDoc.timeline] : []

    if (!timeline.length && this.normalizeNote(beforeDoc?.resolution_note)) {
      timeline.push(
        this.buildTimelineEntry({
          type: 'note_added',
          message: String(beforeDoc.resolution_note),
          payload: {
            actorId: this.toObjectIdString(beforeDoc?.resolver_id),
            actorName: 'Legacy note',
            actorEmail: '',
            actorRole: 'system',
          },
          createdAt: beforeDoc?.updatedAt || beforeDoc?.createdAt || new Date(),
        }),
      )
    }

    return timeline
  }

  private async loadTargetContext(
    targetType: 'Manga' | 'Chapter' | 'Comment' | 'Reply',
    targetId: string | Types.ObjectId,
  ): Promise<TargetContext> {
    const objectId = this.toObjectId(targetId)

    if (targetType === 'Manga') {
      const manga = await this.mangaModel
        .findById(objectId)
        .select('title authorId')
        .lean()

      if (!manga) throw new NotFoundException('Reported manga not found')

      return {
        targetType,
        targetId: objectId,
        targetLabel: manga.title || 'manga',
        ownerUserId: manga.authorId || null,
      }
    }

    if (targetType === 'Chapter') {
      const chapter = await this.chapterModel
        .findById(objectId)
        .select('title manga_id')
        .lean()

      if (!chapter) throw new NotFoundException('Reported chapter not found')

      const manga = await this.mangaModel
        .findById(chapter.manga_id)
        .select('title authorId')
        .lean()

      if (!manga) throw new NotFoundException('Chapter owner not found')

      return {
        targetType,
        targetId: objectId,
        targetLabel: chapter.title || manga.title || 'chapter',
        ownerUserId: manga.authorId || null,
      }
    }

    if (targetType === 'Comment') {
      const comment = await this.commentModel
        .findById(objectId)
        .select('content user_id')
        .lean()

      if (!comment) throw new NotFoundException('Reported comment not found')

      return {
        targetType,
        targetId: objectId,
        targetLabel: 'comment',
        ownerUserId: comment.user_id || null,
      }
    }

    const reply = await this.replyModel
      .findById(objectId)
      .select('content user_id')
      .lean()

    if (!reply) throw new NotFoundException('Reported reply not found')

    return {
      targetType,
      targetId: objectId,
      targetLabel: 'reply',
      ownerUserId: reply.user_id || null,
    }
  }

  private async ensureNotSelfReport(
    reporterId: string,
    targetType: 'Manga' | 'Chapter' | 'Comment' | 'Reply',
    targetId: string,
  ) {
    const target = await this.loadTargetContext(targetType, targetId)
    if (target.ownerUserId && target.ownerUserId.toString() === reporterId) {
      throw new BadRequestException('You cannot report your own content.')
    }
    return target
  }

  private async sendWarningNotification(args: {
    actorId: string
    targetUserId: Types.ObjectId
    reportCode: string
    targetType: string
    note?: string
  }) {
    const body =
      args.note ||
      `Your ${args.targetType.toLowerCase()} was reviewed after report ${args.reportCode}. Please review the community guidelines and avoid repeating the issue.`

    await this.notificationService.createNotification({
      title: `Warning for ${args.reportCode}`,
      body,
      sender_id: args.actorId,
      receiver_id: args.targetUserId.toString(),
      deviceId: [],
    })
  }

  async create(dto: any, payload: JwtPayload) {
    const reporterId = this.requireActorId(payload)
    const description = this.normalizeNote(dto?.description)

    await this.ensureNotSelfReport(reporterId, dto.target_type, dto.target_id)

    const report = await this.reportModel.create({
      reporter_id: new Types.ObjectId(reporterId),
      target_type: dto.target_type,
      target_id: new Types.ObjectId(dto.target_id),
      reason: dto.reason,
      description,
      timeline: [
        this.buildTimelineEntry({
          type: 'report_created',
          message: `Reporter submitted this ${dto.target_type.toLowerCase()} report.`,
          payload,
          meta: { reason: dto.reason },
        }),
      ],
    })

    return report.toObject()
  }

  async findAllForRole(role?: string): Promise<ReportWithTargetDetail[]> {
    const allow = this.allowedTargetTypesByRole(role)
    if (Array.isArray(allow) && allow.length === 0) return []

    const match: any = {}
    if (Array.isArray(allow) && allow.length > 0) {
      match.target_type = { $in: allow }
    }

    const reports = await this.reportModel
      .find(match)
      .populate({ path: 'reporter_id', select: 'username email role avatar' })
      .populate({
        path: 'target_id',
        select: 'title authorId content manga_id user_id comment_id',
        options: { strictPopulate: false },
      })
      .sort({ createdAt: -1 })
      .exec()

    return Promise.all(
      reports.map((report) =>
        this.attachTargetDetail(
          report.toObject() as unknown as ReportWithTargetDetail,
          role,
        ),
      ),
    )
  }

  async findOneForRole(
    id: string,
    role?: string,
  ): Promise<ReportWithTargetDetail | null> {
    const report = await this.reportModel
      .findById(id)
      .populate({ path: 'reporter_id', select: 'username email role avatar' })
      .populate({ path: 'target_id', options: { strictPopulate: false } })
      .exec()

    if (!report) throw new NotFoundException(`Report with id ${id} not found`)

    this.ensureCanAccessReport(role, (report as any).target_type)

    return this.attachTargetDetail(
      report.toObject() as unknown as ReportWithTargetDetail,
      role,
    )
  }

  private async attachTargetDetail(
    reportAny: ReportWithTargetDetail,
    viewerRole?: string,
  ) {
    try {
      reportAny.allowed_resolution_actions = this.allowedResolutionActionsByRole(
        viewerRole,
        reportAny.target_type,
      )

      if (!Array.isArray(reportAny.timeline)) {
        reportAny.timeline = []
      }

      if (!reportAny.timeline.length && this.normalizeNote(reportAny.resolution_note)) {
        reportAny.timeline.push(
          this.buildTimelineEntry({
            type: 'note_added',
            message: String(reportAny.resolution_note),
            payload: {
              actorId: this.toObjectIdString(reportAny.resolver_id),
              actorName: 'Legacy note',
              actorEmail: '',
              actorRole: 'system',
            },
            createdAt: reportAny.updatedAt || reportAny.createdAt,
          }),
        )
      }

      reportAny.timeline = [...reportAny.timeline].sort(
        (first, second) =>
          new Date(first?.createdAt || 0).getTime() -
          new Date(second?.createdAt || 0).getTime(),
      )

      if (reportAny.assignee_id) {
        const assignee = await this.userModel
          .findById(this.toObjectIdString(reportAny.assignee_id))
          .select('username email role avatar')
          .lean()

        reportAny.assignee_detail = assignee
          ? {
              user_id: assignee._id as Types.ObjectId,
              username: assignee.username,
              email: assignee.email,
              role: assignee.role,
              avatar: assignee.avatar,
            }
          : null
      } else {
        reportAny.assignee_detail = null
      }

      if (reportAny.target_type === 'Manga') {
        const manga = reportAny.target_id as MangaTarget
        const author = await this.userModel
          .findById(manga.authorId)
          .select('username email avatar')
          .lean()

        reportAny.target_detail = {
          title: manga.title,
          target_human: author
            ? {
                user_id: manga.authorId,
                username: author.username,
                email: author.email,
                avatar: author.avatar,
              }
            : null,
        }
      } else if (reportAny.target_type === 'Chapter') {
        const chapter = reportAny.target_id as ChapterTarget

        const manga = await this.mangaModel
          .findById(chapter.manga_id)
          .select('title authorId')
          .lean()

        if (manga) {
          const author = await this.userModel
            .findById(manga.authorId)
            .select('username email avatar')
            .lean()

          reportAny.target_detail = {
            title: chapter.title || manga.title || null,
            target_human: author
              ? {
                  user_id: manga.authorId,
                  username: author.username,
                  email: author.email,
                  avatar: author.avatar,
                }
              : null,
          }
        } else {
          reportAny.target_detail = {
            title: chapter.title || null,
            target_human: null,
          }
        }
      } else if (reportAny.target_type === 'Comment') {
        const comment = reportAny.target_id as CommentTarget
        const user = await this.userModel
          .findById(comment.user_id)
          .select('username email avatar')
          .lean()

        reportAny.target_detail = {
          content: comment.content,
          target_human: user
            ? {
                user_id: comment.user_id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
              }
            : {
                user_id: null,
                username: 'Unknown User',
                email: 'No email available',
              },
        }
      } else if (reportAny.target_type === 'Reply') {
        const reply = reportAny.target_id as ReplyTarget
        const user = await this.userModel
          .findById(reply.user_id)
          .select('username email avatar')
          .lean()

        reportAny.target_detail = {
          content: reply.content,
          target_human: user
            ? {
                user_id: reply.user_id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
              }
            : {
                user_id: null,
                username: 'Unknown User',
                email: 'No email available',
              },
        }
      } else {
        reportAny.target_detail = { title: null, target_human: null }
      }
    } catch (err: any) {
      console.error(`Populate detail error for report ${reportAny?._id}:`, err?.message)
      reportAny.target_detail = { title: null, target_human: null }
      reportAny.assignee_detail = null
      reportAny.allowed_resolution_actions = this.allowedResolutionActionsByRole(
        viewerRole,
        reportAny.target_type,
      )
      reportAny.timeline = Array.isArray(reportAny.timeline) ? reportAny.timeline : []
    }

    return reportAny
  }

  async updateByStaff(id: string, dto: any, payload: JwtPayload) {
    const beforeDoc = await this.reportModel.findById(id).lean()
    if (!beforeDoc) throw new NotFoundException(`Report with id ${id} not found`)

    this.ensureCanAccessReport(payload?.role, (beforeDoc as any).target_type)

    const actorId = this.requireActorId(payload)
    const actorRole = this.normalizeRole(payload?.role)
    const note = this.normalizeNote(dto?.note ?? dto?.resolution_note)
    const requestedStatus = dto?.status as ReportStatus | undefined
    const requestedAction =
      (dto?.resolution_action as ReportResolutionAction | undefined) || 'none'

    if (!note && !requestedStatus && requestedAction === 'none') {
      throw new BadRequestException(
        'Provide a progress note, status update, or moderation action.',
      )
    }

    let nextStatus = requestedStatus
    if (!nextStatus && note && beforeDoc.status === 'new') {
      nextStatus = 'in-progress'
    }

    if (requestedAction !== 'none') {
      this.ensureResolutionActionAllowed(
        payload?.role,
        String(beforeDoc.target_type),
        requestedAction,
      )

      if (requestedStatus && requestedStatus !== 'resolved') {
        throw new BadRequestException(
          'A moderation action must resolve the report.',
        )
      }

      nextStatus = 'resolved'
    }

    this.ensureCanHandleAssignment(beforeDoc, actorId, actorRole)
    this.ensureStatusTransition(beforeDoc.status as ReportStatus, nextStatus)

    if (
      (nextStatus === 'resolved' || nextStatus === 'rejected') &&
      !note
    ) {
      throw new BadRequestException(
        'A closing note is required when resolving or rejecting a report.',
      )
    }

    const updates: Record<string, any> = {}
    const timeline = this.getSeedTimeline(beforeDoc)
    const reportCode = this.computeReportCode(beforeDoc._id)
    const beforeStatus = beforeDoc.status as ReportStatus

    if ((nextStatus === 'in-progress' || beforeStatus === 'in-progress') && !beforeDoc.assignee_id) {
      updates.assignee_id = new Types.ObjectId(actorId)
      updates.picked_at = beforeDoc.picked_at || new Date()
    }

    if (nextStatus && nextStatus !== beforeStatus) {
      updates.status = nextStatus

      timeline.push(
        this.buildTimelineEntry({
          type: nextStatus === 'rejected' ? 'report_rejected' : 'status_changed',
          message: `Status changed from ${this.formatStatusLabel(beforeStatus)} to ${this.formatStatusLabel(nextStatus)}.`,
          payload,
          meta: { from: beforeStatus, to: nextStatus },
        }),
      )
    }

    if (note) {
      updates.resolution_note = note
      timeline.push(
        this.buildTimelineEntry({
          type: 'note_added',
          message: note,
          payload,
        }),
      )
    }

    if (requestedAction !== 'none') {
      const targetContext = await this.loadTargetContext(
        beforeDoc.target_type as 'Manga' | 'Chapter' | 'Comment' | 'Reply',
        beforeDoc.target_id,
      )

      if (!targetContext.ownerUserId) {
        throw new BadRequestException('This report does not have a resolvable target owner.')
      }

      if (requestedAction === 'warning_sent') {
        await this.sendWarningNotification({
          actorId,
          targetUserId: targetContext.ownerUserId,
          reportCode,
          targetType: targetContext.targetType,
          note,
        })

        timeline.push(
          this.buildTimelineEntry({
            type: 'warning_sent',
            message: `Warning sent to the reported account for ${reportCode}.`,
            payload,
            meta: { targetUserId: targetContext.ownerUserId.toString() },
          }),
        )
      }

      if (requestedAction === 'user_banned') {
        await this.userService.moderatorBanUser(
          actorId,
          targetContext.ownerUserId.toString(),
          note || `Resolved via ${reportCode}`,
        )

        timeline.push(
          this.buildTimelineEntry({
            type: 'user_banned',
            message: `Reported account was banned for ${reportCode}.`,
            payload,
            meta: { targetUserId: targetContext.ownerUserId.toString() },
          }),
        )
      }

      if (requestedAction === 'user_muted') {
        await this.userService.communityMuteUser(
          actorId,
          targetContext.ownerUserId.toString(),
          note || `Resolved via ${reportCode}`,
        )

        timeline.push(
          this.buildTimelineEntry({
            type: 'user_muted',
            message: `Reported account was muted for ${reportCode}.`,
            payload,
            meta: { targetUserId: targetContext.ownerUserId.toString() },
          }),
        )
      }

      updates.resolution_action = requestedAction
    }

    if (nextStatus === 'resolved' || nextStatus === 'rejected') {
      updates.resolver_id = new Types.ObjectId(actorId)
      updates.resolved_at = new Date()

      if (nextStatus === 'rejected' && requestedAction === 'none') {
        updates.resolution_action = 'none'
      }
    }

    updates.timeline = timeline

    const updated = await this.reportModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .lean()

    if (!updated) throw new NotFoundException(`Report with id ${id} not found`)

    let auditAction = 'report_note_added'
    let auditSummary = 'Staff added a progress note to the report.'

    if (requestedAction === 'warning_sent') {
      auditAction = 'report_resolution_warning_sent'
      auditSummary = `Staff sent a warning and resolved ${reportCode}.`
    } else if (requestedAction === 'user_banned') {
      auditAction = 'report_resolution_user_banned'
      auditSummary = `Staff banned the reported account and resolved ${reportCode}.`
    } else if (requestedAction === 'user_muted') {
      auditAction = 'report_resolution_user_muted'
      auditSummary = `Staff muted the reported account and resolved ${reportCode}.`
    } else if (nextStatus && nextStatus !== beforeStatus) {
      auditAction = `report_status_${nextStatus}`
      auditSummary = `Staff updated report status: ${beforeStatus} -> ${nextStatus}.`
    }

    try {
      await this.audit.createLog({
        actor_id: actorId,
        actor_name: this.getUsername(payload),
        actor_email: this.getEmail(payload),
        actor_role: this.mapAuditActorRole(payload?.role),
        action: auditAction,
        target_type: AuditTargetType.REPORT,
        target_id: id,
        reportCode,
        summary: auditSummary,
        risk: this.getRisk(beforeDoc.reason),
        before: {
          status: beforeDoc.status,
          assignee_id: beforeDoc.assignee_id ?? null,
          resolved_at: beforeDoc.resolved_at ?? null,
          resolution_action: beforeDoc.resolution_action ?? 'none',
          resolution_note: beforeDoc.resolution_note ?? null,
          timeline_count: Array.isArray(beforeDoc.timeline) ? beforeDoc.timeline.length : 0,
        },
        after: {
          status: updated.status,
          assignee_id: updated.assignee_id ?? null,
          resolved_at: (updated as any).resolved_at ?? null,
          resolution_action: (updated as any).resolution_action ?? 'none',
          resolution_note: (updated as any).resolution_note ?? null,
          timeline_count: Array.isArray((updated as any).timeline)
            ? (updated as any).timeline.length
            : 0,
        },
        note,
      })
    } catch (err: any) {
      console.error('Audit log create failed:', err?.message)
    }

    return this.findOneForRole(id, payload?.role)
  }

  async delete(id: string) {
    const deleted = await this.reportModel.findByIdAndDelete(id)
    if (!deleted) throw new NotFoundException(`Report with id ${id} not found`)
    return { message: 'Report deleted successfully', deleted }
  }

  async getAdminSummary() {
    const [open, new7d] = await Promise.all([
      this.reportModel.countDocuments({
        status: { $in: ['new', 'in-progress'] },
      }),
      this.reportModel.countDocuments({
        status: 'new',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ])
    return { open, new7d }
  }

  async getWeeklyNew(weeks = 4) {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - weeks * 7)

    const rows = await this.reportModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: now } } },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: '$createdAt' },
            w: { $isoWeek: '$createdAt' },
          },
          cnt: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          week: {
            $concat: [
              { $toString: '$_id.y' },
              '-W',
              {
                $cond: [
                  { $lt: ['$_id.w', 10] },
                  { $concat: ['0', { $toString: '$_id.w' }] },
                  { $toString: '$_id.w' },
                ],
              },
            ],
          },
          value: '$cnt',
        },
      },
      { $sort: { week: 1 } },
    ])

    return rows
  }
}
