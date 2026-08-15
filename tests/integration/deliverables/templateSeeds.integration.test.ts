// @vitest-environment node
/**
 * Integration tests — GET /api/deliverables/templates z DBR77 seed data (FT-2)
 *
 * Weryfikuje że endpoint zwraca kuratorowane szablony DBR77 per typ.
 * Mockuje serwis tak, żeby symulować zwrot rzeczywistych seed-ów
 * (bez połączenia z DB). Sprawdza is_system=true i strukturę odpowiedzi.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import {
  DBR77_DECK_TEMPLATES,
  DBR77_DOC_TEMPLATES,
  DBR77_TABLE_TEMPLATES,
} from '../../../server/src/services/deliverableTemplateSeedService.js';
import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

// --- Mock: serwis szablonów zwraca rzeczywiste dane seed ---
const listDeliverableTemplatesMock = vi.fn();

vi.mock('../../../server/src/services/deliverableTemplateService.js', () => ({
  listDeliverableTemplates: (...args: any[]) => listDeliverableTemplatesMock(...args),
}));

// --- Mock auth (lightweight) ---
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

// Pomocnik: konwersja seed na format DeliverableTemplate zwracany przez serwis
function docSeedToTemplate(t: (typeof DBR77_DOC_TEMPLATES)[0]) {
  return {
    id: t.id,
    type: 'doc',
    name: t.name,
    description: t.description,
    isSystem: t.is_system,
    isBlank: false,
    organizationId: null,
    meta: { report_type: t.report_type, sections_json: JSON.stringify(t.sections) },
  };
}

function deckSeedToTemplate(t: (typeof DBR77_DECK_TEMPLATES)[0]) {
  return {
    id: t.id,
    type: 'deck',
    name: t.name,
    description: t.description,
    isSystem: t.is_system,
    isBlank: false,
    organizationId: null,
    meta: { theme: null, outline_json: JSON.stringify(t.outline) },
  };
}

function tableSeedToTemplate(t: (typeof DBR77_TABLE_TEMPLATES)[0], idx: number) {
  return {
    id: `uuid-table-${idx}`,
    type: 'table',
    name: t.name,
    description: t.description,
    isSystem: true, // created_by=null → isSystem=true
    isBlank: false,
    organizationId: null,
    meta: { category: t.category, schema_snapshot: t.schema_snapshot },
  };
}

describe('GET /api/deliverables/templates — DBR77 seed integration (FT-2)', () => {
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

  // FT-2.1 — type=doc zwraca ≥1 systemowy szablon DBR77
  it('returns ≥1 system doc template after seed (type=doc)', async function () {
    if (!canListen) return;

    const docTemplates = DBR77_DOC_TEMPLATES.map(docSeedToTemplate);
    listDeliverableTemplatesMock.mockResolvedValue(docTemplates);

    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=doc'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
    expect(res.body.templates.length).toBeGreaterThanOrEqual(1);
    expect(listDeliverableTemplatesMock).toHaveBeenCalledWith('doc', 'org-1', 'user-1');
  });

  // FT-2.2 — type=deck zwraca ≥1 systemowy szablon DBR77
  it('returns ≥1 system deck template after seed (type=deck)', async function () {
    if (!canListen) return;

    const deckTemplates = DBR77_DECK_TEMPLATES.map(deckSeedToTemplate);
    listDeliverableTemplatesMock.mockResolvedValue(deckTemplates);

    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=deck'));

    expect(res.status).toBe(200);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(1);
    expect(listDeliverableTemplatesMock).toHaveBeenCalledWith('deck', 'org-1', 'user-1');
  });

  // FT-2.3 — szablony systemowe mają isSystem=true
  it('system seed templates carry isSystem=true', async function () {
    if (!canListen) return;

    const docTemplates = DBR77_DOC_TEMPLATES.map(docSeedToTemplate);
    listDeliverableTemplatesMock.mockResolvedValue(docTemplates);

    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=doc'));

    expect(res.status).toBe(200);
    const systemTemplates = res.body.templates.filter((t: any) => t.isSystem === true);
    expect(systemTemplates.length).toBeGreaterThanOrEqual(1);
  });

  // FT-2.4 — type=table zwraca ≥1 szablon
  it('returns ≥1 table template after seed (type=table)', async function () {
    if (!canListen) return;

    const tableTemplates = DBR77_TABLE_TEMPLATES.map(tableSeedToTemplate);
    listDeliverableTemplatesMock.mockResolvedValue(tableTemplates);

    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=table'));

    expect(res.status).toBe(200);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(1);
  });

  // FT-2.5 — tabela odpowiedzi ma property "templates" (kształt API)
  it('response always has "templates" array property', async function () {
    if (!canListen) return;

    listDeliverableTemplatesMock.mockResolvedValue(DBR77_DOC_TEMPLATES.map(docSeedToTemplate));
    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=doc'));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  // FT-2.6 — każdy szablon ma id, type, name i isSystem
  it('each returned template has id, type, name and isSystem', async function () {
    if (!canListen) return;

    const deckTemplates = DBR77_DECK_TEMPLATES.map(deckSeedToTemplate);
    listDeliverableTemplatesMock.mockResolvedValue(deckTemplates);

    const res = await authed(request(makeApp()).get('/api/deliverables/templates?type=deck'));

    expect(res.status).toBe(200);
    for (const t of res.body.templates) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('type');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('isSystem');
    }
  });
});
