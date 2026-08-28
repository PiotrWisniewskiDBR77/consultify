/**
 * Acceptance E2E — ensureToolsSchema() log-spam fix (finding confirmed 2x by
 * agents h32/h31 fali W4).
 *
 * Before the fix, `ensureToolsSchema()` in ToolController.ts ran
 * `ALTER TABLE tool_sessions ADD COLUMN <x>` WITHOUT `IF NOT EXISTS` for 7
 * columns (runtime_contract_json, dod_status, wizard_state_json,
 * missing_items_json, failure_reason, last_generation_batch_id, output_json).
 * On every create/update tool_session call AFTER the first, Postgres throws
 * 42701 "column already exists" for each of those 7 columns. The error is
 * swallowed by a try/catch so the request doesn't fail — but
 * queryHelpers.queryRun() calls `logger.error('[QueryHelper] Error in
 * queryRun:', err)` BEFORE the promise rejects, so the try/catch never
 * prevents the log line. Result: 7 error-level log lines per tool_session
 * write, every time, forever — spamming logs and masking real errors.
 *
 * This test creates TWO tool_sessions back-to-back (each POST calls
 * ensureToolsSchema()) and asserts that the SECOND call produces ZERO
 * "already exists" (42701) log lines — proving ensureToolsSchema() is now a
 * true no-op against an already-migrated schema.
 *
 * Isolation: prefix `odbior--ets--`. Cleanup in afterAll. NIE push.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import logger from '../../server/src/utils/Logger.js';
import { mintToken, pgClient } from './harness.js';
import { seed } from './seed.mjs';

const PREFIX = 'odbior--ets--';

async function buildToolsApp(): Promise<Express> {
  const toolsRouter = (await import('../../server/src/routes/tools.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/tools', toolsRouter);
  return app;
}

let toolsApp: Express;
let token: string;
const createdToolSessionIds: string[] = [];

beforeAll(async () => {
  await seed();
  toolsApp = await buildToolsApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdToolSessionIds.length > 0) {
      await client.query(`DELETE FROM tool_sessions WHERE id = ANY($1::text[])`, [
        createdToolSessionIds,
      ]);
    }
  } finally {
    await client.end();
  }
});

describe('ensureToolsSchema — no 42701 log spam on repeat calls', () => {
  it('creates two tool_sessions back-to-back and logs zero "already exists" errors on the second', async () => {
    // Capture everything routed through logger.error during the calls.
    const captured: unknown[][] = [];
    const originalError = logger.error.bind(logger);
    (logger as unknown as { error: (...args: unknown[]) => void }).error = (
      ...args: unknown[]
    ) => {
      captured.push(args);
      return originalError(...(args as [unknown, ...unknown[]]));
    };

    try {
      // First call: on a freshly-migrated schema in this parity DB the columns
      // already exist from prior test runs / migrations, so even the FIRST
      // call should be clean under the fix. We still do two calls to mirror
      // the reported repro (create, then create again) and to make the
      // assertion robust regardless of prior DB state.
      const res1 = await request(toolsApp)
        .post('/api/tools')
        .set('Authorization', `Bearer ${token}`)
        .send({ toolType: 'dynamic-swot', name: `${PREFIX}session-1` });
      expect([200, 201]).toContain(res1.status);
      createdToolSessionIds.push(res1.body?.id);

      // Reset capture buffer before the second call — this is the one that
      // reproduces the bug pre-fix (columns definitely exist by now).
      captured.length = 0;

      const res2 = await request(toolsApp)
        .post('/api/tools')
        .set('Authorization', `Bearer ${token}`)
        .send({ toolType: 'dynamic-swot', name: `${PREFIX}session-2` });
      expect([200, 201]).toContain(res2.status);
      createdToolSessionIds.push(res2.body?.id);

      const spamLines = captured.filter((args) =>
        args.some(
          (a) =>
            typeof a === 'string' &&
            (a.includes('already exists') || a.includes('42701'))
        ) ||
        args.some((a) => {
          const msg = (a as { message?: string } | undefined)?.message;
          return typeof msg === 'string' && (msg.includes('already exists') || msg.includes('42701'));
        })
      );

      if (spamLines.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[ensuretools] UNEXPECTED 42701 spam:', JSON.stringify(spamLines, null, 2));
      }
      expect(spamLines.length).toBe(0);
    } finally {
      (logger as unknown as { error: (...args: unknown[]) => void }).error = originalError;
    }
  }, 30_000);
});
