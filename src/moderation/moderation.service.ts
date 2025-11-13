// src/moderation/moderation.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chapter } from '../schemas/chapter.schema';
import { ChapterModeration } from '../schemas/chapter-moderation.schema';
import { ModerationAction } from '../schemas/moderation-action.schema';
import { AiResultDto } from './dto/ai-result.dto';
import { SubmitDto } from './dto/submit.dto';
import { DecideDto } from './dto/decide.dto';
import { RecheckDto } from './dto/recheck.dto';
import { InvalidateDto } from './dto/invalidate.dto';
import { GeminiModerator } from './gemini.moderator';
import { Policies, PoliciesDocument } from '../schemas/Policies.schema';

// ✅ Verdict cho FindingDto: 'pass' | 'warn' | 'block'
type FindingVerdict = 'pass' | 'warn' | 'block';

// Giữ nguyên verdict tổng thể của Chapter: 'PASSED' | 'WARN' | 'BLOCK'
function toFindingVerdict(
  overall: 'AI_PASSED' | 'AI_WARN' | 'AI_BLOCK',
  severity?: 'low' | 'medium' | 'high',
): FindingVerdict {
  if (overall === 'AI_BLOCK') return 'block';
  if (overall === 'AI_WARN') return 'warn';
  // overall = 'AI_PASSED'
  if (severity === 'high') return 'block';
  if (severity === 'medium') return 'warn';
  return 'pass';
}

@Injectable()
export class ModerationService {
  constructor(
    @InjectModel(Chapter.name) private chapterModel: Model<Chapter>,
    @InjectModel(ChapterModeration.name) private cmModel: Model<ChapterModeration>,
    @InjectModel(ModerationAction.name) private logModel: Model<ModerationAction>,
    @InjectModel(Policies.name) private policiesModel: Model<PoliciesDocument>,
    private readonly gemini: GeminiModerator,
  ) {}

  async submit(dto: SubmitDto, actorId?: string) {
    const chapter = await this.chapterModel.findById(dto.chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');

    await this.cmModel.updateOne(
      { chapter_id: chapter._id },
      {
        $set: {
          chapter_id: chapter._id,
          status: 'AI_PENDING',
          risk_score: 0,
          labels: [],
          policy_version: dto.policyVersion ?? chapter.policy_version ?? '1.0.0',
          ai_model: null,
          ai_findings: [],
          content_hash: dto.contentHash ?? chapter.last_content_hash ?? '',
        },
      },
      { upsert: true },
    );

    await this.logModel.create({
      chapter_id: chapter._id,
      actor_id: actorId ? new Types.ObjectId(actorId) : undefined,
      action: 'ai_check',
      note: 'submitted -> AI_PENDING',
      policy_version: dto.policyVersion ?? chapter.policy_version ?? '1.0.0',
    });

    return { ok: true };
  }

  async saveAiResult(dto: AiResultDto) {
    const chapter = await this.chapterModel.findById(dto.chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');

    await this.cmModel.updateOne(
      { chapter_id: chapter._id },
      {
        $set: {
          status: dto.status,
          risk_score: dto.risk_score,
          labels: dto.labels,
          policy_version: dto.policy_version,
          ai_model: dto.ai_model,
          ai_findings: dto.ai_findings,
          content_hash: dto.content_hash,
        },
      },
      { upsert: true },
    );

    // Verdict tổng thể (giữ nguyên format cũ trên Chapter)
    const verdict = dto.status === 'AI_PASSED' ? 'PASSED' : dto.status === 'AI_WARN' ? 'WARN' : 'BLOCK';
    await this.chapterModel.updateOne(
      { _id: chapter._id },
      {
        $set: {
          ai_checked: true,
          ai_verdict: verdict,
          risk_score: dto.risk_score,
          policy_version: dto.policy_version,
          last_content_hash: dto.content_hash,
        },
      },
    );

    await this.logModel.create({
      chapter_id: chapter._id,
      action: 'ai_check',
      result: { status: dto.status, risk_score: dto.risk_score },
      policy_version: dto.policy_version,
      ai_model: dto.ai_model,
    });

    return { ok: true, verdict };
  }

  async decide(dto: DecideDto, adminId: string) {
    const chapter = await this.chapterModel.findById(dto.chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');

    if (dto.action === 'approve') {
      await this.chapterModel.updateOne({ _id: chapter._id }, { $set: { is_published: true } });
    } else if (dto.action === 'reject') {
      await this.chapterModel.updateOne({ _id: chapter._id }, { $set: { is_published: false } });
    } else if (dto.action === 'request_changes') {
      // optional
    }

    await this.logModel.create({
      chapter_id: chapter._id,
      actor_id: new Types.ObjectId(adminId),
      action: dto.action,
      note: dto.note,
      policy_version: chapter.policy_version,
    });

    return { ok: true };
  }

  async recheck(dto: RecheckDto, adminId: string) {
  const chapter = await this.chapterModel.findById(dto.chapterId);
  if (!chapter) throw new NotFoundException('Chapter not found');

  await this.cmModel.updateOne(
    { chapter_id: chapter._id },
    {
      $set: {
        status: 'AI_PENDING',
        policy_version: dto.policyVersion ?? chapter.policy_version ?? '1.0.0',
        content_hash: dto.contentHash ?? chapter.last_content_hash ?? '',
        ai_findings: [],
        labels: [],
        risk_score: 0,
        ai_model: null,
      },
    },
    { upsert: true },
  );

  await this.logModel.create({
    chapter_id: chapter._id,
    actor_id: new Types.ObjectId(adminId),
    action: 'recheck',
    policy_version: dto.policyVersion ?? chapter.policy_version ?? '1.0.0',
  });

  // 🔥 KICK OFF AI CHECK (chọn 1 trong 2)

  // (A) Fire-and-forget: trả về ngay cho FE, AI chạy nền
  setImmediate(() => {
    this.runAiCheck(chapter._id.toString(), {
      policyVersion: dto.policyVersion,
      contentHtml: undefined, // hoặc truyền nếu FE gửi
    }).catch(err => {
      // optional: log để debug
      console.error('[recheck/runAiCheck] failed:', err);
    });
  });

  // (B) Hoặc đợi AI xong rồi mới trả (nếu nội bộ nhanh)
  // await this.runAiCheck(chapter._id.toString(), {
  //   policyVersion: dto.policyVersion,
  //   contentHtml: undefined,
  // });

  return { ok: true, started: true };
}


  async invalidate(dto: InvalidateDto, actorId?: string) {
    const chapter = await this.chapterModel.findById(dto.chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');

    await this.chapterModel.updateOne(
      { _id: chapter._id },
      {
        $set: {
          ai_checked: false,
          ai_verdict: null,
          risk_score: null,
          last_content_hash: dto.contentHash,
        },
      },
    );

    await this.logModel.create({
      chapter_id: chapter._id,
      actor_id: actorId ? new Types.ObjectId(actorId) : undefined,
      action: 'request_changes',
      note: 'content updated -> invalidate AI result',
    });

    return { ok: true };
  }

  // ====== Chạy AI kiểm duyệt trực tiếp ======
  async runAiCheck(chapterId: string, opts?: { contentHtml?: string; policyVersion?: string }) {
    const chapter = await this.chapterModel.findById(chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');

    const agg = await this.chapterModel.aggregate([
      { $match: { _id: new Types.ObjectId(chapterId) } },
      {
        $lookup: {
          from: 'textchapters',
          localField: '_id',
          foreignField: 'chapter_id',
          as: 'texts',
        },
      },
      { $project: { title: 1, 'texts.content': 1 } },
    ]);

    const record = agg[0];
    const htmlFromDb: string =
      opts?.contentHtml ??
      (record?.texts?.length ? String(record.texts[0].content || '') : '');

    const policies = await this.policiesModel
      .find({ status: 'Active', isPublic: true, subCategory: 'posting' })
      .select('title content mainType subCategory')
      .lean();

    const out = await this.gemini.check({
      chapterTitle: record?.title || chapter.title || 'Untitled',
      chapterHtml: htmlFromDb,
      policies,
      policyVersion: opts?.policyVersion || chapter.policy_version || '1.0.0',
    });

    // ✅ Map ModerationFinding[] -> FindingDto[] (verdict: 'pass'|'warn'|'block')
    const findingsDto = (out.ai_findings || []).map((f) => ({
      sectionId: f.policy || 'general',
      verdict: toFindingVerdict(out.status, f.severity),
      rationale: f.evidence ? `${f.reason} | evidence: ${f.evidence}` : f.reason,
    }));

    const dto: AiResultDto = {
      chapterId: chapter._id.toString(),
      status: out.status,
      risk_score: out.risk_score,
      labels: out.labels,
      policy_version: out.policy_version,
      ai_model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      ai_findings: findingsDto,
      content_hash: out.content_hash ?? chapter.last_content_hash ?? '', // luôn string
    };

    return this.saveAiResult(dto);
  }

  // Hàng chờ cho admin
  // src/moderation/moderation.service.ts
async listQueue(params: { status?: string; limit?: number }) {
  const query: any = {};
  if (params.status) query.status = params.status;

  const limit = params.limit ?? 50;

  const rows = await this.cmModel.aggregate([
    { $match: query },
    { $sort: { risk_score: -1, updatedAt: -1 } },
    { $limit: limit },

    // --- Join -> Chapter (ép kiểu chapter_id nếu là string) ---
    {
      $lookup: {
        from: 'chapters',
        let: { chId: '$chapter_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$_id',
                  {
                    $cond: [
                      { $eq: [{ $type: '$$chId' }, 'string'] },
                      { $toObjectId: '$$chId' },
                      '$$chId',
                    ],
                  },
                ],
              },
            },
          },
          { $project: { title: 1, manga_id: 1 } },
        ],
        as: 'ch',
      },
    },
    { $unwind: { path: '$ch', preserveNullAndEmptyArrays: true } },

    // --- Join -> Manga từ ch.manga_id (cũng ép kiểu) ---
    {
      $lookup: {
        from: 'mangas',
        let: { mgId: '$ch.manga_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$_id',
                  {
                    $cond: [
                      { $eq: [{ $type: '$$mgId' }, 'string'] },
                      { $toObjectId: '$$mgId' },
                      '$$mgId',
                    ],
                  },
                ],
              },
            },
          },
          { $project: { authorId: 1 } },
        ],
        as: 'manga',
      },
    },
    { $unwind: { path: '$manga', preserveNullAndEmptyArrays: true } },

    // --- Join -> User từ manga.authorId (cũng ép kiểu) ---
    {
      $lookup: {
        from: 'users',
        let: { auId: '$manga.authorId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$_id',
                  {
                    $cond: [
                      { $eq: [{ $type: '$$auId' }, 'string'] },
                      { $toObjectId: '$$auId' },
                      '$$auId',
                    ],
                  },
                ],
              },
            },
          },
          { $project: { username: 1, email: 1 } },
        ],
        as: 'author',
      },
    },
    { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },

    // --- Shape cho FE ---
    {
      $project: {
        _id: 0,
        chapter_id: '$chapter_id',
        status: '$status',
        risk_score: { $ifNull: ['$risk_score', 0] },
        labels: { $ifNull: ['$labels', []] },
        updatedAt: '$updatedAt',

        chapterTitle: { $ifNull: ['$ch.title', '-'] },
        authorName: {
          $ifNull: [
            '$author.username',
            { $ifNull: ['$author.email', '-'] },
          ],
        },
      },
    },
  ]);

  return rows;
}


 async getRecord(chapterId: string) {
  if (!Types.ObjectId.isValid(chapterId)) {
    throw new NotFoundException('Moderation record not found');
  }

  const agg = await this.cmModel.aggregate([
    { $match: { chapter_id: new Types.ObjectId(chapterId) } },

    // Join -> Chapter
    { $lookup: { from: 'chapters', localField: 'chapter_id', foreignField: '_id', as: 'ch' } },
    { $unwind: { path: '$ch', preserveNullAndEmptyArrays: true } },

    // Join -> Manga
    { $lookup: { from: 'mangas', localField: 'ch.manga_id', foreignField: '_id', as: 'manga' } },
    { $unwind: { path: '$manga', preserveNullAndEmptyArrays: true } },

    // Join -> User (author)
    { $lookup: { from: 'users', localField: 'manga.authorId', foreignField: '_id', as: 'author' } },
    { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },

    // Join -> TextChapters (lấy HTML để hiển thị)
    { $lookup: { from: 'textchapters', localField: 'chapter_id', foreignField: 'chapter_id', as: 'texts' } },

    {
      $project: {
        _id: 0,
        chapter_id: 1,
        status: 1,
        risk_score: { $ifNull: ['$risk_score', 0] },
        labels: { $ifNull: ['$labels', []] },
        policy_version: 1,
        ai_model: 1,
        ai_findings: 1,
        updatedAt: 1,

        chapterTitle: { $ifNull: ['$ch.title', 'Untitled'] },
        authorName: {
          $ifNull: [
            '$author.username',
            { $ifNull: ['$author.email', '-'] }
          ]
        },

        // lấy content đầu tiên, nếu có
        contentHtml: {
          $let: {
            vars: { firstText: { $arrayElemAt: ['$texts', 0] } },
            in: { $ifNull: ['$$firstText.content', ''] }
          }
        },
      }
    }
  ]);

  if (!agg.length) throw new NotFoundException('Moderation record not found');
  return agg[0];
}

}
