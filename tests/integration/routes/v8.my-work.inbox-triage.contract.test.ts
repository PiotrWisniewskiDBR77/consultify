import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApplyGovernedInboxTriage = vi.fn();
const mockApplyGovernedBulkInboxTriage = vi.fn();

vi.mock('../../../server/src/services/inboxTriageService.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/inboxTriageService.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    applyGovernedInboxTriage: (...args: unknown[]) => mockApplyGovernedInboxTriage(...args),
    applyGovernedBulkInboxTriage: (...args: unknown[]) => mockApplyGovernedBulkInboxTriage(...args),
  };
});

vi.mock('../../../server/src/services/notebookConversionService.js', () => {
  class NotebookConversionError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  return {
    convertNotebookPage: vi.fn(),
    NotebookConversionError,
  };
});

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async (table: string) => {
    if (table === 'canonical_inbox_items') return new Set(['id']);
    if (table === 'my_work_inbox_triage') return new Set(['id']);
    if (table === 'my_work_focus_state') return new Set(['id']);
    return new Set(['id']);
  }),
}));

import myWorkRoutes from '../../../server/src/routes/v8/my-work.routes.js';

const ORG = 'dbr77';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: USER_ID,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/my-work', myWorkRoutes);
  return app;
}

describe('MyWork inbox triage contract routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyGovernedInboxTriage.mockResolvedValue({ success: true });
    mockApplyGovernedBulkInboxTriage.mockResolvedValue({ success: true, processed: 1 });
  });

  it('returns coded 400 when triage action is invalid', async () => {
    const res = await request(createApp()).post('/api/v8/my-work/inbox/item-1/triage').send({
      action: 'invalid-action',
      itemKey: 'task:123',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INBOX_TRIAGE_ACTION_INVALID');
    expect(res.body.error).toBe('Invalid action');
    expect(mockApplyGovernedInboxTriage).not.toHaveBeenCalled();
  });

  it('returns coded 400 when triage itemKey is missing or malformed', async () => {
    const res = await request(createApp()).post('/api/v8/my-work/inbox/item-1/triage').send({
      action: 'accept_today',
      itemKey: 'missing-delimiter',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INBOX_TRIAGE_ITEM_KEY_REQUIRED');
    expect(res.body.error).toContain('Missing itemKey');
    expect(mockApplyGovernedInboxTriage).not.toHaveBeenCalled();
  });

  it('returns coded 400 when bulk triage has no item keys', async () => {
    const res = await request(createApp()).post('/api/v8/my-work/inbox/bulk-triage').send({
      action: 'accept_today',
      itemKeys: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INBOX_TRIAGE_ITEM_KEYS_REQUIRED');
    expect(res.body.error).toBe('Missing itemKeys[]');
    expect(mockApplyGovernedBulkInboxTriage).not.toHaveBeenCalled();
  });
});
