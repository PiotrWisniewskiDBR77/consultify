// @vitest-environment node
/**
 * Integration tests — T3: CRUD endpoints /api/deliverables/templates
 *
 * FT-2: ≥4 happy-path + FT-8: ≥2 security (system-guard, cross-org).
 *
 * Mockuje serwis + auth middleware; weryfikuje HTTP semantics przez supertest.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

// --- Mock serwisu szablonów ---
const listDeliverableTemplatesMock = vi.fn();
const createDeliverableTemplateMock = vi.fn();
const updateDeliverableTemplateMock = vi.fn();
const deleteDeliverableTemplateMock = vi.fn();
const getDeliverableTemplateMock = vi.fn();

class MockTemplateForbiddenError extends Error {
  constructor(msg = 'Cannot modify system template') {
    super(msg);
    this.name = 'TemplateForbiddenError';
  }
}
class MockTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Template not found: ${id}`);
    this.name = 'TemplateNotFoundError';
  }
}

vi.mock('../../../server/src/services/deliverableTemplateService.js', () => ({
  listDeliverableTemplates: (...args: any[]) => listDeliverableTemplatesMock(...args),
  createDeliverableTemplate: (...args: any[]) => createDeliverableTemplateMock(...args),
  updateDeliverableTemplate: (...args: any[]) => updateDeliverableTemplateMock(...args),
  deleteDeliverableTemplate: (...args: any[]) => deleteDeliverableTemplateMock(...args),
  getDeliverableTemplate: (...args: any[]) => getDeliverableTemplateMock(...args),
  TemplateForbiddenError: MockTemplateForbiddenError,
  TemplateNotFoundError: MockTemplateNotFoundError,
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

// ─────────────────────────────────────────────────────────────
const SAMPLE_DOC_TEMPLATE = {
  id: 'tpl-doc-1',
  type: 'doc' as const,
  name: 'My Custom Doc',
  description: null,
  isSystem: false,
  isBlank: false,
  organizationId: 'org-1',
  meta: { report_type: 'custom', sections_json: '[]' },
};

const SAMPLE_DECK_TEMPLATE = {
  id: 'tpl-deck-1',
  type: 'deck' as const,
  name: 'My Custom Deck',
  description: 'Test deck',
  isSystem: false,
  isBlank: false,
  organizationId: 'org-1',
  meta: { theme: null, outline_json: '[]' },
};

// ─────────────────────────────────────────────────────────────
describe('CRUD /api/deliverables/templates (T3)', () => {
  let canListen: boolean;
  let router: any;

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

  // ── FT-2 happy-path ───────────────────────────────────────

  // FT-2.I1 — POST → 201 z id
  it('POST /templates returns 201 with template id (doc)', async function () {
    if (!canListen) return;
    createDeliverableTemplateMock.mockResolvedValue(SAMPLE_DOC_TEMPLATE);

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates')
        .send({ type: 'doc', name: 'My Custom Doc' })
    );

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('template');
    expect(res.body.template.id).toBe('tpl-doc-1');
    expect(createDeliverableTemplateMock).toHaveBeenCalledWith(
      'doc', 'My Custom Doc', undefined, undefined, 'org-1', 'user-1'
    );
  });

  // FT-2.I2 — PUT → 200 (update name)
  it('PUT /templates/:id returns 200 with updated template', async function () {
    if (!canListen) return;
    const updated = { ...SAMPLE_DECK_TEMPLATE, name: 'Renamed Deck' };
    updateDeliverableTemplateMock.mockResolvedValue(updated);

    const res = await authed(
      request(makeApp())
        .put('/api/deliverables/templates/tpl-deck-1')
        .send({ name: 'Renamed Deck' })
    );

    expect(res.status).toBe(200);
    expect(res.body.template.name).toBe('Renamed Deck');
    expect(updateDeliverableTemplateMock).toHaveBeenCalledWith(
      'tpl-deck-1',
      expect.objectContaining({ name: 'Renamed Deck' }),
      'org-1',
      'user-1'
    );
  });

  // FT-2.I3 — DELETE → 204
  it('DELETE /templates/:id returns 204 on success', async function () {
    if (!canListen) return;
    deleteDeliverableTemplateMock.mockResolvedValue(true);

    const res = await authed(
      request(makeApp()).delete('/api/deliverables/templates/tpl-doc-1')
    );

    expect(res.status).toBe(204);
    expect(deleteDeliverableTemplateMock).toHaveBeenCalledWith('tpl-doc-1', 'org-1', 'user-1');
  });

  // FT-2.I4 — GET /:id → 200 z danymi
  it('GET /templates/:id returns 200 with template data', async function () {
    if (!canListen) return;
    getDeliverableTemplateMock.mockResolvedValue(SAMPLE_DOC_TEMPLATE);

    const res = await authed(
      request(makeApp()).get('/api/deliverables/templates/tpl-doc-1')
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('template');
    expect(res.body.template.id).toBe('tpl-doc-1');
    expect(res.body.template.type).toBe('doc');
    expect(getDeliverableTemplateMock).toHaveBeenCalledWith('tpl-doc-1', 'org-1');
  });

  // FT-2.I5 — GET /:id nieistniejący → 404
  it('GET /templates/:id returns 404 when not found', async function () {
    if (!canListen) return;
    getDeliverableTemplateMock.mockResolvedValue(null);

    const res = await authed(
      request(makeApp()).get('/api/deliverables/templates/nonexistent')
    );

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // FT-2.I6 — POST bez name → 400
  it('POST /templates without name returns 400', async function () {
    if (!canListen) return;
    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates')
        .send({ type: 'doc' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
    expect(createDeliverableTemplateMock).not.toHaveBeenCalled();
  });

  // FT-2.I7 — POST z type='invalid' → 400
  it('POST /templates with invalid type returns 400', async function () {
    if (!canListen) return;
    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates')
        .send({ type: 'invalid', name: 'Test' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
    expect(createDeliverableTemplateMock).not.toHaveBeenCalled();
  });

  // FT-2.I8 — DELETE → 404 gdy nie istnieje
  it('DELETE /templates/:id returns 404 when template does not exist', async function () {
    if (!canListen) return;
    deleteDeliverableTemplateMock.mockResolvedValue(false);

    const res = await authed(
      request(makeApp()).delete('/api/deliverables/templates/ghost-id')
    );

    expect(res.status).toBe(404);
  });

  // ── FT-8 security ─────────────────────────────────────────

  // FT-8.S1 — DELETE system template → 403
  it('FT-8: DELETE system template returns 403', async function () {
    if (!canListen) return;
    deleteDeliverableTemplateMock.mockRejectedValue(
      new MockTemplateForbiddenError('Cannot modify system template')
    );

    const res = await authed(
      request(makeApp()).delete('/api/deliverables/templates/dbr77-doc-audit-report')
    );

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/system/i);
  });

  // FT-8.S2 — PUT innej organizacji → 403 (cross-org)
  it('FT-8: PUT cross-org template returns 403', async function () {
    if (!canListen) return;
    updateDeliverableTemplateMock.mockRejectedValue(
      new MockTemplateForbiddenError('Cross-org update not allowed')
    );

    const res = await authed(
      request(makeApp())
        .put('/api/deliverables/templates/other-org-tpl')
        .send({ name: 'Hacked' })
    );

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  // FT-8.S3 — PUT system template → 403
  it('FT-8: PUT system template returns 403', async function () {
    if (!canListen) return;
    updateDeliverableTemplateMock.mockRejectedValue(
      new MockTemplateForbiddenError('Cannot modify system template')
    );

    const res = await authed(
      request(makeApp())
        .put('/api/deliverables/templates/dbr77-deck-board')
        .send({ name: 'Evil Rename' })
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/system|cross/i);
  });
});
