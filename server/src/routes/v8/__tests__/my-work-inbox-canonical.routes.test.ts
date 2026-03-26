import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanonicalInboxItem } from '../../../services/inboxService.js';

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockGetInboxItems = vi.fn();
const mockGetInboxStats = vi.fn();
const mockMaterializeInboxItems = vi.fn();
const mockApplyGovernedInboxTriage = vi.fn();
const mockApplyGovernedBulkInboxTriage = vi.fn();

vi.mock('../../../services/inboxService.js', () => ({
  default: {
    getInboxItems: (...a: unknown[]) => mockGetInboxItems(...a),
    getInboxStats: (...a: unknown[]) => mockGetInboxStats(...a),
    materializeInboxItems: (...a: unknown[]) => mockMaterializeInboxItems(...a),
  },
}));

vi.mock('../../../services/inboxTriageService.js', () => ({
  VALID_INBOX_TRIAGE_ACTIONS: [
    'accept_today',
    'accept_week',
    'accept_later',
    'schedule',
    'delegate',
    'archive',
    'dismiss',
    'done',
    'save',
    'reject',
  ],
  applyGovernedInboxTriage: (...a: unknown[]) => mockApplyGovernedInboxTriage(...a),
  applyGovernedBulkInboxTriage: (...a: unknown[]) => mockApplyGovernedBulkInboxTriage(...a),
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = 'org-inbox-v8';
const UID = 'user-inbox-v8';

describe('B-05 V8 My Work inbox canonical routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
  });

  it('GET /api/v8/my-work/inbox/canonical returns v8 envelope and forwards filters to inboxService', async () => {
    const sample: CanonicalInboxItem[] = [
      {
        id: 'item-1',
        userId: UID,
        organizationId: ORG,
        itemType: 'task',
        sourceEntityType: 'task',
        sourceEntityId: 't-1',
        title: 'Example',
        priority: 'normal',
        section: 'assigned_tasks',
        status: 'pending',
        slaStatus: 'on_track',
        createdAt: new Date().toISOString(),
      },
    ];
    mockGetInboxItems.mockResolvedValue(sample);

    const res = await request(createApp())
      .get('/api/v8/my-work/inbox/canonical')
      .query({ section: 'assigned_tasks', limit: '10', offset: '0' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({
      version: 'v8',
      contract: 'my_work_inbox_canonical_v1',
    });
    expect(res.body.data.items).toEqual(sample);
    expect(mockGetInboxItems).toHaveBeenCalledWith(UID, ORG, {
      section: 'assigned_tasks',
      status: undefined,
      priority: undefined,
      slaStatus: undefined,
      limit: 10,
      offset: 0,
    });
  });

  it('GET /api/v8/my-work/inbox/canonical/stats returns v8 envelope', async () => {
    const stats = {
      total: 2,
      bySection: { assigned_tasks: 2 },
      bySlaStatus: { on_track: 2 },
      byPriority: { normal: 2 },
      byStatus: { pending: 2 },
    };
    mockGetInboxStats.mockResolvedValue(stats);

    const res = await request(createApp()).get('/api/v8/my-work/inbox/canonical/stats');

    expect(res.status).toBe(200);
    expect(res.body.meta.contract).toBe('my_work_inbox_canonical_v1');
    expect(res.body.data).toEqual(stats);
    expect(mockGetInboxStats).toHaveBeenCalledWith(UID, ORG);
  });

  it('POST /api/v8/my-work/inbox/canonical/materialize returns 201 with upsert counts', async () => {
    mockMaterializeInboxItems.mockResolvedValue({ upserted: 3 });

    const res = await request(createApp()).post('/api/v8/my-work/inbox/canonical/materialize').send({});

    expect(res.status).toBe(201);
    expect(res.body.meta.version).toBe('v8');
    expect(res.body.data).toEqual({ success: true, upserted: 3 });
    expect(mockMaterializeInboxItems).toHaveBeenCalledWith(UID, ORG);
  });

  it('POST /api/v8/my-work/inbox/:itemId/triage returns mutation envelope', async () => {
    mockApplyGovernedInboxTriage.mockResolvedValue({
      success: true,
      triagedAt: '2026-03-25T12:00:00.000Z',
      item: null,
    });

    const res = await request(createApp()).post('/api/v8/my-work/inbox/item-1/triage').send({
      action: 'save',
      itemKey: 'task:t-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({
      version: 'v8',
      contract: 'my_work_inbox_triage_mutation_v1',
    });
    expect(mockApplyGovernedInboxTriage).toHaveBeenCalledWith({
      userId: UID,
      organizationId: ORG,
      itemId: 'item-1',
      itemKey: 'task:t-1',
      action: 'save',
      params: undefined,
      fromAISuggestion: false,
      confidence: undefined,
    });
  });

  it('POST /api/v8/my-work/inbox/bulk-triage returns mutation envelope', async () => {
    mockApplyGovernedBulkInboxTriage.mockResolvedValue({
      success: true,
      triagedAt: '2026-03-25T12:00:00.000Z',
      processed: 2,
    });

    const res = await request(createApp()).post('/api/v8/my-work/inbox/bulk-triage').send({
      action: 'done',
      itemKeys: ['task:t-1', 'task:t-2'],
      items: [
        { itemId: 'item-1', itemKey: 'task:t-1' },
        { itemId: 'item-2', itemKey: 'task:t-2' },
      ],
      aiItems: [{ itemKey: 'task:t-2', confidence: 0.92 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.meta.contract).toBe('my_work_inbox_triage_mutation_v1');
    expect(mockApplyGovernedBulkInboxTriage).toHaveBeenCalledWith({
      userId: UID,
      organizationId: ORG,
      items: [
        { itemId: 'item-1', itemKey: 'task:t-1' },
        { itemId: 'item-2', itemKey: 'task:t-2' },
      ],
      itemKeys: ['task:t-1', 'task:t-2'],
      action: 'done',
      params: undefined,
      aiItems: [{ itemKey: 'task:t-2', confidence: 0.92 }],
    });
  });
});
