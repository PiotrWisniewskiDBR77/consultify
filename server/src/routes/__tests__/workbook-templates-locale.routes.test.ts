/** @vitest-environment node */

/**
 * `GET /api/workbook/templates` — EN first (DEC-461/F7b, 2026-09-14).
 *
 * DEFECT: the route returned the 9 registered Excel templates (Materials →
 * Sheets) with Polish titles/descriptions/param labels/groups hardcoded,
 * regardless of caller locale — 261 Polish characters even for an
 * English-speaking user. Fixed by making English the registry default and
 * resolving the caller's locale (DEC-510 pattern: explicit override →
 * users.language → users.locale → organizations.default_language → 'en').
 *
 * This suite exercises the REAL route + REAL template registry (only the DB
 * lookup is stubbed) end-to-end over HTTP, so it proves the WIRING, not just
 * that `listWorkbookTemplates(locale)` itself works (covered separately by
 * `services/workbook/templates/__tests__/templateLocale.i18n.test.ts`).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
function countPolishChars(value: unknown): number {
  return (JSON.stringify(value).match(POLISH_DIACRITICS) || []).length;
}

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
    }
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Only the DB lookup is stubbed — locale resolution + the template registry
// itself run FOR REAL.
const dbGetMock = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => dbGetMock(...args),
  all: vi.fn().mockResolvedValue([]),
  run: vi.fn().mockResolvedValue({ changes: 0 }),
}));

import workbookRoutes from '../workbook.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/workbook', workbookRoutes);
  return app;
}

function asUser(id: string, organizationId: string): void {
  mockUser = { id, organizationId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
  dbGetMock.mockResolvedValue(undefined);
});

describe('GET /api/workbook/templates — locale resolution', () => {
  it('defaults to English (zero Polish characters) with no locale signal anywhere', async () => {
    asUser('user-1', 'org-1');
    dbGetMock.mockResolvedValue(undefined); // no users.language/locale, no org default_language

    const res = await request(createApp()).get('/api/workbook/templates');

    expect(res.status).toBe(200);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(9);
    expect(countPolishChars(res.body.templates)).toBe(0);
  });

  it('returns Polish when the user has users.language = pl', async () => {
    asUser('user-pl', 'org-1');
    dbGetMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT language FROM users')) return Promise.resolve({ language: 'pl' });
      return Promise.resolve(undefined);
    });

    const res = await request(createApp()).get('/api/workbook/templates');

    expect(res.status).toBe(200);
    expect(countPolishChars(res.body.templates)).toBeGreaterThan(0);
    const breakEven = res.body.templates.find((t: { id: string }) => t.id === 'breakEven');
    expect(breakEven.name).toBe('Analiza progu rentowności (Break-Even)');
  });

  it('falls back to organizations.default_language = pl when the user has no preference', async () => {
    asUser('user-2', 'org-pl');
    dbGetMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM organizations')) return Promise.resolve({ defaultLanguage: 'pl' });
      return Promise.resolve(undefined);
    });

    const res = await request(createApp()).get('/api/workbook/templates');

    expect(res.status).toBe(200);
    expect(countPolishChars(res.body.templates)).toBeGreaterThan(0);
  });

  it('an explicit ?lang=pl query override wins even without any DB row', async () => {
    asUser('user-3', 'org-1');
    dbGetMock.mockResolvedValue(undefined);

    const res = await request(createApp()).get('/api/workbook/templates?lang=pl');

    expect(res.status).toBe(200);
    expect(countPolishChars(res.body.templates)).toBeGreaterThan(0);
  });

  it('English title/name is returned verbatim for a known template id', async () => {
    asUser('user-4', 'org-1');
    dbGetMock.mockResolvedValue(undefined);

    const res = await request(createApp()).get('/api/workbook/templates');
    const breakEven = res.body.templates.find((t: { id: string }) => t.id === 'breakEven');
    expect(breakEven.name).toBe('Break-even analysis (BEP)');
  });

  it('401s without an authenticated user (unrelated to locale)', async () => {
    mockUser = null;
    const res = await request(createApp()).get('/api/workbook/templates');
    expect(res.status).toBe(401);
  });
});
