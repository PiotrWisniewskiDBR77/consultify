// @vitest-environment node
/**
 * Integration tests — T4: POST /api/deliverables/templates/suggest
 *
 * FT-2: ≥3 happy-path + validation + auth.
 *
 * Mockuje serwis suggest + auth middleware; weryfikuje HTTP semantics przez supertest.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

// --- Mock serwisu suggest ---
const suggestTemplateMock = vi.fn();

vi.mock('../../../server/src/services/deliverableTemplateSuggestService.js', () => ({
  suggestTemplate: (...args: any[]) => suggestTemplateMock(...args),
}));

// --- Mock serwisu szablonów (wymagany przez router import) ---
vi.mock('../../../server/src/services/deliverableTemplateService.js', () => ({
  listDeliverableTemplates: vi.fn().mockResolvedValue([]),
  createDeliverableTemplate: vi.fn(),
  updateDeliverableTemplate: vi.fn(),
  deleteDeliverableTemplate: vi.fn(),
  getDeliverableTemplate: vi.fn(),
  TemplateForbiddenError: class TemplateForbiddenError extends Error {},
  TemplateNotFoundError: class TemplateNotFoundError extends Error {},
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
describe('POST /api/deliverables/templates/suggest (T4)', () => {
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

  // FT-2.S1 — POST z poprawną intencją → 200 { suggestion }
  it('returns 200 with suggestion for valid intent', async function () {
    if (!canListen) return;

    const mockSuggestion = {
      templateId: 'dbr77-doc-audit-report',
      confidence: 'high',
      reasoning: 'Keyword match (score 2): audit, raport',
    };
    suggestTemplateMock.mockResolvedValue(mockSuggestion);

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ intent: 'raport audytowy dostawców', type: 'doc' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suggestion');
    expect(res.body.suggestion).toEqual(mockSuggestion);
    expect(suggestTemplateMock).toHaveBeenCalledWith(
      'raport audytowy dostawców',
      'doc',
      'org-1',
      { useLlm: false }
    );
  });

  // FT-2.S2 — POST gdy brak dopasowania → 200 { suggestion: null }
  it('returns 200 with suggestion=null when no match found', async function () {
    if (!canListen) return;

    suggestTemplateMock.mockResolvedValue(null);

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ intent: 'completely unrelated thing xyz', type: 'deck' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suggestion');
    expect(res.body.suggestion).toBeNull();
  });

  // FT-2.S3 — POST z useLlm=true → przekazuje flagę do serwisu
  it('passes useLlm=true to suggestTemplate service', async function () {
    if (!canListen) return;

    suggestTemplateMock.mockResolvedValue({ templateId: 'dbr77-table-kpi-dashboard', confidence: 'medium', reasoning: 'LLM' });

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ intent: 'kpi metrics', type: 'table', useLlm: true })
    );

    expect(res.status).toBe(200);
    expect(suggestTemplateMock).toHaveBeenCalledWith(
      'kpi metrics',
      'table',
      'org-1',
      { useLlm: true }
    );
  });

  // FT-2.S4 — POST bez intent → 400
  it('returns 400 when intent is missing', async function () {
    if (!canListen) return;

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ type: 'doc' })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/intent/i);
    expect(suggestTemplateMock).not.toHaveBeenCalled();
  });

  // FT-2.S5 — POST z pustym intent → 400
  it('returns 400 when intent is empty string', async function () {
    if (!canListen) return;

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ intent: '   ', type: 'doc' })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/intent/i);
  });

  // FT-2.S6 — POST z nieprawidłowym type → 400
  it('returns 400 when type is invalid', async function () {
    if (!canListen) return;

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ intent: 'audit report', type: 'invalid' })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  // FT-2.S7 — POST bez autoryzacji → 401
  it('returns 401 without auth token', async function () {
    if (!canListen) return;

    const res = await request(makeApp())
      .post('/api/deliverables/templates/suggest')
      .send({ intent: 'audit report', type: 'doc' });

    expect(res.status).toBe(401);
  });

  // FT-2.S8 — POST gdy serwis rzuci wyjątek → fail-open 200 { suggestion: null }
  it('fail-open: service throw returns 200 { suggestion: null }', async function () {
    if (!canListen) return;

    suggestTemplateMock.mockRejectedValue(new Error('Unexpected DB error'));

    const res = await authed(
      request(makeApp())
        .post('/api/deliverables/templates/suggest')
        .send({ intent: 'test intent', type: 'doc' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suggestion');
    expect(res.body.suggestion).toBeNull();
  });
});
