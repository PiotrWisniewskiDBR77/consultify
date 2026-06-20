/**
 * notebookToday.routes — unit tests (MOCK_DB via queryHelpers mock).
 *
 * Drives the registered `GET /today` handler directly with a fake router that
 * captures the handler, a stubbed getV8Context (org+owner scope) and a mocked
 * queryHelpers layer.
 *
 * Covers:
 *  - /today returns the 4 cockpit keys (pinned/recent/toReview/freshCaptures)
 *  - every section query is org + owner scoped (organization_id = ?, owner_user_id = ?)
 *  - a section that throws degrades to [] instead of 500-ing the cockpit
 */

import type { Response, Router } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the DB access layer ────────────────────────────────────────────────
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

// ── Stub org/owner context resolution ───────────────────────────────────────
vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => ({
  getV8Context: vi.fn(() => ({ organizationId: 'org1', userId: 'user1' })),
}));

import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';
import { registerNotebookTodayRoutes } from '../../../server/src/routes/v8/notebookToday.routes';

const mockQueryAll = queryHelpers.queryAll as unknown as ReturnType<typeof vi.fn>;

type Handler = (req: any, res: any, next: any) => any;

/** Capture the GET /today handler registered onto a fake router. */
function captureTodayHandler(): Handler {
  let captured: Handler | undefined;
  const fakeRouter = {
    get: (path: string, handler: Handler) => {
      if (path === '/today') captured = handler;
    },
  } as unknown as Router;
  registerNotebookTodayRoutes(fakeRouter);
  if (!captured) throw new Error('GET /today handler was not registered');
  return captured;
}

/** Build a fake Express response that records the JSON body. */
function makeRes(): { res: Response; body: () => any; status: () => number } {
  let jsonBody: any;
  let statusCode = 200;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    },
  } as unknown as Response;
  return { res, body: () => jsonBody, status: () => statusCode };
}

async function invoke(): Promise<{ body: any }> {
  const handler = captureTodayHandler();
  const { res, body } = makeRes();
  const next = vi.fn((err?: unknown) => {
    if (err) throw err;
  });
  await handler({} as any, res, next as any);
  expect(next).not.toHaveBeenCalledWith(expect.anything());
  return { body: body() };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Column probe (first queryAll) → all optional columns present.
  // Section queries default to [] unless a test overrides them.
  mockQueryAll.mockImplementation(async (sql: string) => {
    if (/information_schema\.columns/.test(sql)) {
      return [
        { column_name: 'status' },
        { column_name: 'pinned' },
        { column_name: 'capture_source' },
        { column_name: 'verification_status' },
        { column_name: 'icon' },
      ];
    }
    return [];
  });
});

describe('GET /api/v8/notebook/today', () => {
  it('returns the four cockpit sections', async () => {
    const { body } = await invoke();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('pinned');
    expect(body.data).toHaveProperty('recent');
    expect(body.data).toHaveProperty('toReview');
    expect(body.data).toHaveProperty('freshCaptures');
    expect(Object.keys(body.data).sort()).toEqual(
      ['freshCaptures', 'pinned', 'recent', 'toReview'].sort()
    );
  });

  it('scopes every section to org + owner', async () => {
    await invoke();
    const sectionCalls = mockQueryAll.mock.calls.filter(
      (c) => !/information_schema\.columns/.test(String(c[0]))
    );
    // pinned, recent, toReview, freshCaptures = 4 section queries.
    expect(sectionCalls.length).toBe(4);
    for (const call of sectionCalls) {
      const sql = String(call[0]);
      expect(sql).toMatch(/organization_id = \?/);
      expect(sql).toMatch(/owner_user_id = \?/);
      expect(call[1]).toEqual(['org1', 'user1']);
    }
  });

  it('maps rows into the lightweight Today shape', async () => {
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (/information_schema\.columns/.test(sql)) {
        return [
          { column_name: 'status' },
          { column_name: 'pinned' },
          { column_name: 'capture_source' },
          { column_name: 'verification_status' },
          { column_name: 'icon' },
        ];
      }
      // recent section (no extra WHERE filter beyond the bare scope)
      if (!/pinned = 1|capture_source IS NOT NULL|disputed|1 = 0/.test(sql)) {
        return [
          {
            id: 'p1',
            title: 'Note 1',
            icon: null,
            status: 'active',
            pinned: 1,
            capture_source: 'quick',
            verification_status: 'disputed',
            updated_at: '2026-06-20',
          },
        ];
      }
      return [];
    });

    const { body } = await invoke();
    const recent = body.data.recent;
    expect(recent).toHaveLength(1);
    expect(recent[0]).toEqual({
      id: 'p1',
      title: 'Note 1',
      icon: null,
      status: 'active',
      pinned: true,
      captureSource: 'quick',
      verificationStatus: 'disputed',
      updatedAt: '2026-06-20',
    });
  });

  it('degrades a failing section to [] instead of throwing', async () => {
    let firstSection = true;
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (/information_schema\.columns/.test(sql)) {
        return [{ column_name: 'pinned' }, { column_name: 'status' }];
      }
      if (firstSection) {
        firstSection = false;
        throw new Error('boom');
      }
      return [];
    });

    const { body } = await invoke();
    // All sections still present; the failing one is just empty.
    expect(body.data.pinned).toEqual([]);
    expect(Array.isArray(body.data.recent)).toBe(true);
    expect(Array.isArray(body.data.toReview)).toBe(true);
    expect(Array.isArray(body.data.freshCaptures)).toBe(true);
  });
});
