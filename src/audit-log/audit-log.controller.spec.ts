import { PassThrough } from 'stream';

import { AuditLogController } from './audit-log.controller';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let auditService: any;

  beforeEach(() => {
    auditService = {
      findAll: jest.fn(),
      exportCsv: jest.fn(),
      findOne: jest.fn(),
      markSeen: jest.fn(),
      approve: jest.fn(),
      markAllSeen: jest.fn(),
    };

    controller = new AuditLogController(auditService);
  });

  it('passes list filters through to the service', async () => {
    auditService.findAll.mockResolvedValue({ rows: [] });

    await controller.list(
      'alice',
      'admin',
      'report_status_new',
      'unseen',
      'high',
      'custom',
      '2026-03-01',
      '2026-03-31',
      '10',
      '2',
    );

    expect(auditService.findAll).toHaveBeenCalledWith({
      search: 'alice',
      role: 'admin',
      action: 'report_status_new',
      status: 'unseen',
      risk: 'high',
      dateRange: 'custom',
      from: '2026-03-01',
      to: '2026-03-31',
      limit: 10,
      page: 2,
    });
  });

  it('streams csv export with download headers', async () => {
    const stream = new PassThrough();
    const res = new PassThrough() as PassThrough & {
      setHeader: jest.Mock;
    };
    res.setHeader = jest.fn();

    auditService.exportCsv.mockResolvedValue({
      filename: 'audit-logs-2026-03-31.csv',
      stream,
    });

    const exportPromise = controller.exportRows(
      res as any,
      'alice',
      'admin',
      'report_status_new',
      'unseen',
      'high',
      '7days',
      undefined,
      undefined,
    );

    stream.end('csv-data');
    await exportPromise;

    expect(auditService.exportCsv).toHaveBeenCalledWith({
      search: 'alice',
      role: 'admin',
      action: 'report_status_new',
      status: 'unseen',
      risk: 'high',
      dateRange: '7days',
      from: undefined,
      to: undefined,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="audit-logs-2026-03-31.csv"',
    );
  });

  it('marks matching seen rows using the same filter query', async () => {
    auditService.markAllSeen.mockResolvedValue({ updated: 5 });

    const req: any = {
      user: {
        userId: 'admin-1',
      },
    };

    await controller.seenAll(
      req,
      'report',
      'admin',
      'report_status_new',
      'unseen',
      'high',
      'custom',
      '2026-03-01',
      '2026-03-31',
    );

    expect(auditService.markAllSeen).toHaveBeenCalledWith('admin-1', {
      search: 'report',
      role: 'admin',
      action: 'report_status_new',
      status: 'unseen',
      risk: 'high',
      dateRange: 'custom',
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });
});
