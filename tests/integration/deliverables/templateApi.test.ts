// @vitest-environment node
/**
 * Integration tests — GET /api/deliverables/templates
 *
 * Używa makeTestApp (lightweight express wrapper bez pełnego Gateway).
 * Weryfikuje walidację type, strukturę odpowiedzi i ochronę auth.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

// --- Mock serwisu szablonów ---
const listDeliverableTemplatesMock = vi.fn();

vi.mock('../../../server/src/services/deliverableTemplateService.js', () => ({
  listDeliverableTemplates: (...args: any[]) => listDeliverableTemplatesMock(...args),
}));

// --- Mock auth middleware ---
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 'user-1', organizationId: 'org-1', organization_id: 'org-1', role: 'ADMIN' };
      next();
    } else {
      _res.status(401).json({ error: 'Unauthorized' });
    }
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('GET /api/deliverables/templates', () => {
  let canListen: boolean;
  let router: any;

  const SAMPLE_DECK = [
    {
      id: 'd1',
      type: 'deck',
      name: 'Corporate Deck',
      description: null,
      isSystem: true,
      isBlank: false,
      organizationId: null,
      meta: {},
    },
  ];
  const SAMPLE_DOC = [
    {
      id: 'doc1',
      type: 'doc',
      name: 'Audit Report',
      description: 'Full audit',
      isSystem: true,
      isBlank: false,
      organizationId: null,
      meta: {},
    },
  ];
  const SAMPLE_TABLE = [
    {
      id: 't1',
      type: 'table',
      name: 'Risk Register',
      description: null,
      isSystem: true,
      isBlank: false,
      organizationId: null,
      meta: {},
    },
  ];

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/deliverableTemplates.routes.js')).default;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/deliverables', router });
  const authed = (req: request.Test) => req.set('Authorization', 'Bearer valid-token');

  // FT-2.1 — deck
  it('returns deck templates for type=deck', async function () {
    if (!canListen) return;
    listDeliverableTemplatesMock.mockResolvedValue(SAMPLE_DECK);
    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=deck'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
    expect(res.body.templates).toEqual(SAMPLE_DECK);
    expect(listDeliverableTemplatesMock).toHaveBeenCalledWith('deck', 'org-1', 'user-1');
  });

  // FT-2.2 — doc
  it('returns doc templates for type=doc', async function () {
    if (!canListen) return;
    listDeliverableTemplatesMock.mockResolvedValue(SAMPLE_DOC);
    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=doc'));
    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual(SAMPLE_DOC);
    expect(listDeliverableTemplatesMock).toHaveBeenCalledWith('doc', 'org-1', 'user-1');
  });

  // FT-2.3 — table
  it('returns table templates for type=table', async function () {
    if (!canListen) return;
    listDeliverableTemplatesMock.mockResolvedValue(SAMPLE_TABLE);
    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=table'));
    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual(SAMPLE_TABLE);
    expect(listDeliverableTemplatesMock).toHaveBeenCalledWith('table', 'org-1', 'user-1');
  });

  // FT-2.4 — invalid type → 400
  it('returns 400 for invalid type', async function () {
    if (!canListen) return;
    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=invalid'));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(listDeliverableTemplatesMock).not.toHaveBeenCalled();
  });

  // FT-2.5 — no auth → 401
  it('returns 401 without auth token', async function () {
    if (!canListen) return;
    const res = await request(makeApp()).get('/api/deliverables/templates?type=deck');
    expect(res.status).toBe(401);
  });

  // FT-2.6 — empty type param → 400
  it('returns 400 when type param is missing', async function () {
    if (!canListen) return;
    const res = await authed(request(makeApp()).get('/api/deliverables/templates'));
    expect(res.status).toBe(400);
  });

  // FT-2.7 — service returns empty list (no templates for org)
  it('returns empty templates list for org with no custom templates', async function () {
    if (!canListen) return;
    listDeliverableTemplatesMock.mockResolvedValue([]);
    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=deck'));
    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual([]);
  });

  // FT-2.8 — org-scope: service called with correct orgId
  it('passes correct orgId to service (org-scope isolation)', async function () {
    if (!canListen) return;
    listDeliverableTemplatesMock.mockResolvedValue([]);
    await authed(request(makeApp()).get('/api/deliverables/templates?type=doc'));
    expect(listDeliverableTemplatesMock).toHaveBeenCalledWith('doc', 'org-1', 'user-1');
  });
});
