import { Readable } from 'stream';
import { Types } from 'mongoose';

import { AuditLogService } from './audit-log.service';
import { AuditApprovalStatus } from 'src/schemas/AuditLog.schema';

function createAsyncCursor(rows: any[]) {
  return {
    close: jest.fn().mockResolvedValue(undefined),
    async *[Symbol.asyncIterator]() {
      for (const row of rows) {
        yield row;
      }
    },
  };
}

function createFindQuery(rows: any[], cursorRows = rows) {
  const cursor = createAsyncCursor(cursorRows);
  const query: any = {
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    cursor: jest.fn().mockReturnValue(cursor),
    then: (resolve: (value: any[]) => unknown) => Promise.resolve(resolve(rows)),
  };

  return { query, cursor };
}

function createLeanQuery(rows: any[]) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    then: (resolve: (value: any[]) => unknown) => Promise.resolve(resolve(rows)),
  };

  return query;
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let model: any;
  let commentModel: any;
  let replyModel: any;

  beforeEach(() => {
    model = {
      find: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateMany: jest.fn(),
    };
    commentModel = {
      find: jest.fn(),
    };
    replyModel = {
      find: jest.fn(),
    };

    service = new AuditLogService(model, commentModel, replyModel);
  });

  it('builds filtered list queries with summary data', async () => {
    const rows = [{ _id: 'log-1', action: 'report_status_new' }];
    const { query } = createFindQuery(rows);
    commentModel.find.mockReturnValue(createLeanQuery([]));
    replyModel.find.mockReturnValue(createLeanQuery([]));

    model.find.mockReturnValue(query);
    model.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { total: 9, unseen: 4, pendingApproval: 3, highRisk: 2 },
      ]),
    });

    const result = await service.findAll({
      search: 'Alice@example.com',
      role: 'admin',
      status: 'unseen',
      dateRange: 'today',
      page: 2,
      limit: 10,
    });

    expect(model.find).toHaveBeenCalledTimes(1);

    const filter = model.find.mock.calls[0][0];
    expect(filter.actor_role).toBe('admin');
    expect(filter.seen).toBe(false);
    expect(filter.createdAt.$gte).toBeInstanceOf(Date);
    expect(filter.createdAt.$lte).toBeInstanceOf(Date);
    expect(filter.$or).toHaveLength(4);
    expect(String(filter.$or[0].reportCode)).toContain('^Alice@example\\.com');
    expect(String(filter.$or[3].summary)).toContain('Alice@example\\.com');

    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result.rows).toEqual(rows);
    expect(result.summary).toEqual({
      total: 9,
      unseen: 4,
      pendingApproval: 3,
      highRisk: 2,
    });
    expect(result.total).toBe(9);
    expect(result.totalPages).toBe(1);
  });

  it('streams CSV export with formatted labels', async () => {
    const csvRows = [
      {
        createdAt: '2026-03-31T01:02:03.000Z',
        actor_name: 'Alice',
        actor_email: 'alice@example.com',
        actor_role: 'content_moderator',
        action: 'report_status_resolved',
        before: { status: 'new' },
        after: { status: 'resolved' },
        risk: 'high',
        seen: true,
        approval: AuditApprovalStatus.APPROVED,
      },
      {
        createdAt: '2026-03-31T05:06:07.000Z',
        actor_name: 'Cory',
        actor_email: 'cory@example.com',
        actor_role: 'community_manager',
        action: 'mute_user',
        summary: 'Community manager muted nina (nina@example.com)',
        before: {
          target_username: 'nina',
          target_email: 'nina@example.com',
          status: 'normal',
        },
        after: {
          target_username: 'nina',
          target_email: 'nina@example.com',
          status: 'mute',
        },
        risk: 'medium',
        seen: false,
        approval: AuditApprovalStatus.PENDING,
      },
      {
        createdAt: '2026-03-31T08:09:10.000Z',
        actor_name: 'Mila',
        actor_email: 'mila@example.com',
        actor_role: 'content_moderator',
        action: 'comment_hidden',
        summary: 'Comment hidden: "Spoiler chapter 10" by Nia',
        before: {
          is_delete: false,
          author_name: 'Nia',
          content_preview: 'Spoiler chapter 10',
        },
        after: {
          is_delete: true,
          author_name: 'Nia',
          content_preview: 'Spoiler chapter 10',
        },
        risk: 'low',
        seen: false,
        approval: AuditApprovalStatus.PENDING,
      },
    ];
    const { query, cursor } = createFindQuery([], csvRows);
    commentModel.find.mockReturnValue(createLeanQuery([]));
    replyModel.find.mockReturnValue(createLeanQuery([]));

    model.find.mockReturnValue(query);

    const { filename, stream } = await service.exportCsv({
      search: 'alice',
      dateRange: '7days',
    });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      (stream as Readable).on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      });
      (stream as Readable).on('end', resolve);
      (stream as Readable).on('error', reject);
    });

    const csv = Buffer.concat(chunks).toString('utf8');

    expect(filename).toMatch(/^audit-logs-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(query.select).toHaveBeenCalled();
    expect(cursor.close).toHaveBeenCalled();
    expect(csv).toContain('Actor,Email,Role,Action,Message,Risk,Seen,Approval');
    expect(csv).toContain('Content Moderator');
    expect(csv).toContain('Report - Resolved');
    expect(csv).toContain('Updated status: New -> Resolved');
    expect(csv).toContain('User - Muted');
    expect(csv).toContain('Community manager muted nina (nina@example.com)');
    expect(csv).toContain('Comment hidden for Nia: ""Spoiler chapter 10""');
    expect(csv).toContain('Yes');
    expect(csv).toContain('approved');
  });

  it('hydrates old comment logs with current comment preview for UI consumption', async () => {
    const rows = [
      {
        _id: 'log-comment',
        action: 'comment_hidden',
        target_type: 'Comment',
        target_id: new Types.ObjectId().toString(),
        before: { is_delete: false },
        after: { is_delete: true },
      },
    ];
    const { query } = createFindQuery(rows);

    model.find.mockReturnValue(query);
    model.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ total: 1, unseen: 1, pendingApproval: 1, highRisk: 0 }]),
    });
    commentModel.find.mockReturnValue(
      createLeanQuery([
        {
          _id: rows[0].target_id,
          content: 'Spoiler chapter 12 ending',
          user_id: {
            username: 'Nia',
            email: 'nia@example.com',
          },
        },
      ]),
    );
    replyModel.find.mockReturnValue(createLeanQuery([]));

    const result = await service.findAll({ limit: 10, page: 1 });

    expect(commentModel.find).toHaveBeenCalled();
    expect(result.rows[0].before.content_preview).toBe('Spoiler chapter 12 ending');
    expect(result.rows[0].before.author_name).toBe('Nia');
  });

  it('marks only matching unseen logs as seen', async () => {
    model.updateMany.mockResolvedValue({ modifiedCount: 3 });
    const adminId = new Types.ObjectId().toString();

    const result = await service.markAllSeen(adminId, {
      role: 'admin',
      risk: 'high',
      search: 'AL-100',
      dateRange: '30days',
    });

    const [filter, update] = model.updateMany.mock.calls[0];
    expect(filter.actor_role).toBe('admin');
    expect(filter.risk).toBe('high');
    expect(filter.seen).toBe(false);
    expect(filter.$or).toHaveLength(4);
    expect(filter.createdAt.$gte).toBeInstanceOf(Date);
    expect(update.seen).toBe(true);
    expect(update.seenBy).toBeInstanceOf(Types.ObjectId);
    expect(update.seenAt).toBeInstanceOf(Date);
    expect(result).toEqual({ updated: 3 });
  });

  it('approves and marks a single log with audit metadata', async () => {
    const adminId = new Types.ObjectId().toString();
    model.findByIdAndUpdate
      .mockResolvedValueOnce({ _id: 'seen-log', seen: true })
      .mockResolvedValueOnce({ _id: 'approved-log', approval: 'approved' });

    const seenResult = await service.markSeen('seen-log', adminId);
    const approveResult = await service.approve(
      'approved-log',
      adminId,
      'Reviewed and accepted.',
    );

    expect(model.findByIdAndUpdate).toHaveBeenNthCalledWith(
      1,
      'seen-log',
      expect.objectContaining({
        seen: true,
        seenBy: expect.any(Types.ObjectId),
        seenAt: expect.any(Date),
      }),
      { new: true },
    );
    expect(model.findByIdAndUpdate).toHaveBeenNthCalledWith(
      2,
      'approved-log',
      expect.objectContaining({
        approval: AuditApprovalStatus.APPROVED,
        approvedBy: expect.any(Types.ObjectId),
        approvedAt: expect.any(Date),
        adminNote: 'Reviewed and accepted.',
      }),
      { new: true },
    );
    expect(seenResult).toEqual({ _id: 'seen-log', seen: true });
    expect(approveResult).toEqual({
      _id: 'approved-log',
      approval: 'approved',
    });
  });
});
