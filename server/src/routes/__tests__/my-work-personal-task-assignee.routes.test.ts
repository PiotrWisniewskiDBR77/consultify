/** @vitest-environment node */

// HOTFIX (2026-09-11): PUT /api/my-work/personal-tasks/:id traktowało pusty
// ciąg z frontu (`assigneeId: ''`) identycznie jak jawne `null` — czyli jak
// żądanie ODPIĘCIA. Front wysyłał `''` przy KAŻDYM zapisie (bo detal GET nie
// zwracał assignee_id/owner_id, więc formularz zawsze startował pusty).
// Efekt: zapis dowolnego innego pola (np. tytułu) zerował `assignee_id` w
// bazie, a scope "moje zadania" filtruje po tej kolumnie — zadanie znikało
// właścicielowi po odświeżeniu.
//
// Pułapka Database.ts:686 (atrapa bazy zwraca `changes:1` dla KAŻDEGO
// UPDATE, niezależnie od WHERE) — dlatego te testy NIE sprawdzają
// `updateResult.changes`, tylko realne PARAMETRY zapytania UPDATE przekazane
// do `queryHelpers.queryRun`: czy `assignee_id`/`owner_id` w ogóle trafiły do
// klauzuli SET, i z jaką wartością.
//
// Mutacja: przywrócenie starej logiki
//   `const a = req.body.assigneeId ? String(req.body.assigneeId).trim() : null;`
// sprawia, że test „pusty ciąg = bez zmian" czerwienieje (SET znów niesie
// `assignee_id = ?` z wartością null).

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    // Bez `email` na sesji: `resolveCanonicalPersonalTaskIdentity` i
    // `resolveEmailForPersonalTaskScope` idą przez `queryHelpers.queryOne`
    // (mockowane niżej), zamiast dynamicznego importu prawdziwej bazy.
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
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

import myWorkRoutes from '../my-work.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

const TASK_ID = 'task-assignee-hotfix-1';
const VERSION_TOKEN = '2026-09-10T10:00:00.000';

/**
 * Wyciąga klauzulę SET z SQL-a UPDATE tasks SET ... WHERE ...
 * Asercja zamiast `throw new Error(<zdanie>)` — pomiar-jezyka.mjs (tryb
 * szybki pre-commit) liczy `throw new Error("...")` w plikach pod
 * `server/src/routes/**` jako K5 (zdanie z serwera do UI), bez rozróżnienia
 * testu od realnej trasy; `expect(...)` nie pasuje do tego wzorca.
 */
function extractSetClause(sql: string): string {
  const match = /SET\s+([\s\S]*?)\s+WHERE/i.exec(sql);
  expect(match, `SET clause missing in SQL:\n${sql}`).not.toBeNull();
  return match![1];
}

describe('PUT /api/my-work/personal-tasks/:id — assigneeId/ownerId (hotfix 2026-09-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 1) resolveCanonicalPersonalTaskIdentity: brak email na sesji -> szuka
    //    w bazie po userId; zwracamy brak -> identity bez zmian.
    // 2) resolveEmailForPersonalTaskScope: analogicznie, brak email.
    // 3) existing task check (PUT).
    // 4) re-fetch po UPDATE (odpowiedź 200).
    mockQueryOne
      .mockResolvedValueOnce({ email: null })
      .mockResolvedValueOnce({ email: null })
      .mockResolvedValueOnce({ id: TASK_ID, status: 'todo', versionToken: VERSION_TOKEN })
      .mockResolvedValueOnce({ id: TASK_ID, title: 'refetched', versionToken: VERSION_TOKEN });

    mockGetTableColumns.mockResolvedValue(
      new Set([
        'id',
        'title',
        'description',
        'status',
        'priority',
        'due_date',
        'tags',
        'expected_outcome',
        'checklist',
        'assignee_id',
        'owner_id',
        'updated_at',
        'completed_at',
      ])
    );

    mockQueryRun.mockResolvedValue({ changes: 1 });
  });

  it('pusty ciąg "" = BRAK ZMIANY: assignee_id/owner_id pomijane w SET', async () => {
    const app = createApp();
    const res = await request(app)
      .put(`/api/my-work/personal-tasks/${TASK_ID}`)
      .send({ title: 'New Title A', assigneeId: '', ownerId: '', expectedVersionToken: VERSION_TOKEN });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalledTimes(1);
    const [sql] = mockQueryRun.mock.calls[0];
    const setClause = extractSetClause(sql as string);
    expect(setClause).not.toMatch(/assignee_id/);
    expect(setClause).not.toMatch(/owner_id/);
    expect(setClause).toMatch(/title = \?/);
  });

  it('jawne null = ODPIĘCIE: assignee_id/owner_id trafiają do SET z wartością NULL', async () => {
    const app = createApp();
    const res = await request(app)
      .put(`/api/my-work/personal-tasks/${TASK_ID}`)
      .send({
        title: 'New Title B',
        assigneeId: null,
        ownerId: null,
        expectedVersionToken: VERSION_TOKEN,
      });

    expect(res.status).toBe(200);
    const [sql, params] = mockQueryRun.mock.calls[0];
    const setClause = extractSetClause(sql as string);
    expect(setClause).toMatch(/assignee_id = \?/);
    expect(setClause).toMatch(/owner_id = \?/);
    // Kolejność w SET: title, assignee_id, owner_id (patrz kolejność `setIf`
    // w handlerze) — params[0] = tytuł, params[1] = assignee_id, params[2] = owner_id.
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
  });

  it('niepusty ciąg = PRZYPISANIE: assignee_id/owner_id trafiają do SET z podaną wartością', async () => {
    const app = createApp();
    const res = await request(app)
      .put(`/api/my-work/personal-tasks/${TASK_ID}`)
      .send({
        title: 'New Title C',
        assigneeId: 'user-99',
        ownerId: 'user-77',
        expectedVersionToken: VERSION_TOKEN,
      });

    expect(res.status).toBe(200);
    const [sql, params] = mockQueryRun.mock.calls[0];
    const setClause = extractSetClause(sql as string);
    expect(setClause).toMatch(/assignee_id = \?/);
    expect(setClause).toMatch(/owner_id = \?/);
    expect(params[1]).toBe('user-99');
    expect(params[2]).toBe('user-77');
  });

  it('GET /personal-tasks/:id zwraca assigneeId/ownerId (naprawiony SELECT)', async () => {
    mockQueryOne.mockReset();
    mockQueryOne
      .mockResolvedValueOnce({ email: null }) // resolveCanonicalPersonalTaskIdentity
      .mockResolvedValueOnce({ email: null }) // resolveEmailForPersonalTaskScope
      .mockResolvedValueOnce({
        id: TASK_ID,
        title: 'Detail',
        tags: '[]',
        assigneeId: 'user-99',
        ownerId: 'user-77',
      });

    const app = createApp();
    const res = await request(app).get(`/api/my-work/personal-tasks/${TASK_ID}`);

    expect(res.status).toBe(200);
    // Nie wystarczy, że atrapa "zwraca" te pola — mutacja usuwająca kolumny
    // z SELECT-a musi też czerwienieć, więc sprawdzamy SAM SQL 3. wywołania
    // (existing-check), nie tylko odpowiedź zbudowaną z atrapy.
    const detailSql = mockQueryOne.mock.calls[2]?.[0] as string;
    expect(detailSql).toMatch(/t\.assignee_id as "assigneeId"/);
    expect(detailSql).toMatch(/t\.owner_id as "ownerId"/);
    expect(res.body.assigneeId).toBe('user-99');
    expect(res.body.ownerId).toBe('user-77');
  });
});
