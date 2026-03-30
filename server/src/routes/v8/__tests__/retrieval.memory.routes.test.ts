import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateWorkingMemoryEntry = vi.fn();
const mockGetWorkingMemory = vi.fn();
const mockRequestMemoryPromotion = vi.fn();
const mockResolveMemoryPromotion = vi.fn();

vi.mock('../../../services/v8/knowledgeRetrievalService.js', () => ({
  createWorkingMemoryEntry: (...args: unknown[]) => mockCreateWorkingMemoryEntry(...args),
  getWorkingMemory: (...args: unknown[]) => mockGetWorkingMemory(...args),
  requestMemoryPromotion: (...args: unknown[]) => mockRequestMemoryPromotion(...args),
  resolveMemoryPromotion: (...args: unknown[]) => mockResolveMemoryPromotion(...args),
}));

import retrievalRouter from '../retrieval.routes.js';

const ORG = '00000000-0000-4000-8000-000000000088';
const UID = 'user-knowledge-1';

function createApp(userRole: string): Express {
  const app = express();
  app.use(express.json());
  // Attach V8 context (matches middleware/v8Auth contract)
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: UID,
      userRole,
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/retrieval', retrievalRouter);
  return app;
}

describe('V8 retrieval memory + promotion routes (P34-B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateWorkingMemoryEntry.mockResolvedValue({
      entryId: 'wm-1',
      conversationId: '00000000-0000-4000-8000-000000000001',
      organizationId: ORG,
      memoryType: 'user_private_durable',
      content: 'Private knowledge',
      sourceRef: null,
      createdAt: '2026-03-30T00:00:00.000Z',
      expiresAt: null,
    });
    mockGetWorkingMemory.mockResolvedValue([]);
    mockRequestMemoryPromotion.mockResolvedValue({
      requestId: 'promo-1',
      organizationId: ORG,
      sourceEntryId: 'wm-1',
      targetMemoryType: 'organization_durable',
      promotionStatus: 'pending',
      provenanceRef: 'prov:1',
      requestedBy: UID,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: '2026-03-30T00:00:00.000Z',
    });
    mockResolveMemoryPromotion.mockResolvedValue({
      requestId: 'promo-1',
      organizationId: ORG,
      sourceEntryId: 'wm-1',
      targetMemoryType: 'organization_durable',
      promotionStatus: 'approved',
      provenanceRef: 'prov:1',
      requestedBy: 'user-a',
      resolvedBy: UID,
      resolvedAt: '2026-03-30T00:01:00.000Z',
      createdAt: '2026-03-30T00:00:00.000Z',
    });
  });

  it('POST /memory/entries creates a working memory entry (org-scoped)', async () => {
    const app = createApp('TEAM_MEMBER');
    const res = await request(app).post('/api/v8/retrieval/memory/entries').send({
      conversationId: '00000000-0000-4000-8000-000000000001',
      memoryType: 'user_private_durable',
      content: 'Private knowledge',
      provenanceRef: 'ignored',
    });

    expect(res.status).toBe(201);
    expect(res.body.meta?.version).toBe('v8');
    expect(res.body.data?.entryId).toBe('wm-1');
    expect(mockCreateWorkingMemoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: '00000000-0000-4000-8000-000000000001',
        organizationId: ORG,
        memoryType: 'user_private_durable',
        content: 'Private knowledge',
      })
    );
  });

  it('GET /memory/entries lists working memory for a conversation', async () => {
    const app = createApp('TEAM_MEMBER');
    const res = await request(app)
      .get('/api/v8/retrieval/memory/entries')
      .query({ conversationId: '00000000-0000-4000-8000-000000000001' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.version).toBe('v8');
    expect(mockGetWorkingMemory).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      ORG
    );
  });

  it('POST /memory/promotions submits a private→org promotion request with provenance', async () => {
    const app = createApp('TEAM_MEMBER');
    const res = await request(app).post('/api/v8/retrieval/memory/promotions').send({
      sourceEntryId: '00000000-0000-4000-8000-000000000002',
      targetMemoryType: 'organization_durable',
      provenanceRef: 'prov:1',
    });

    expect(res.status).toBe(201);
    expect(res.body.data?.promotionStatus).toBe('pending');
    expect(mockRequestMemoryPromotion).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        sourceEntryId: '00000000-0000-4000-8000-000000000002',
        targetMemoryType: 'organization_durable',
        provenanceRef: 'prov:1',
        requestedBy: UID,
      })
    );
  });

  it('POST /memory/promotions/:requestId/resolve requires an admin reviewer role', async () => {
    const app = createApp('TEAM_MEMBER');
    const res = await request(app)
      .post('/api/v8/retrieval/memory/promotions/promo-1/resolve')
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROMOTION_REVIEW_FORBIDDEN');
    expect(mockResolveMemoryPromotion).not.toHaveBeenCalled();
  });

  it('POST /memory/promotions/:requestId/resolve approves when reviewer is ADMIN', async () => {
    const app = createApp('ADMIN');
    const res = await request(app)
      .post('/api/v8/retrieval/memory/promotions/promo-1/resolve')
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data?.promotionStatus).toBe('approved');
    expect(mockResolveMemoryPromotion).toHaveBeenCalledWith('promo-1', 'approved', UID);
  });
});

