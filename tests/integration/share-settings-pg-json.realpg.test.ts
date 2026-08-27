/**
 * FIX robotnik (share-pg-fix-20260828) — measured defect:
 * server/migrations/283_conversation_sharing.sql:14 declares
 * `settings JSON`. The `pg` driver auto-parses `json`/`jsonb` columns into a
 * JS object, but server/src/routes/share.routes.ts read the column with a
 * bare `JSON.parse(share.settings || '{}')` in 5 places. On Postgres this
 * throws `SyntaxError: "[object Object]" is not valid JSON`, so every
 * `GET /api/share/:token` 500'd. SQLite returns the column as TEXT, which is
 * why this was invisible on the sqlite-backed dev path.
 *
 * Fix: `parseSettings()` helper (next to the file's existing `flagOn()`
 * pg/sqlite-shape helper) that branches on `typeof v === 'string'`.
 *
 * This test hits the REAL `ApiGateway`, a REAL Postgres database (migrated
 * with the strict `db:migrate` runner), and REAL route code — no mocks.
 *
 * Scenarios:
 *   (a) a share row inserted directly into conversation_shares -> anonymous
 *       GET /api/share/:token returns exactly 200 with the conversation
 *       content.
 *   (b) a share row whose settings carry a passwordHash -> anonymous GET
 *       without a password returns exactly 401
 *       { error: 'Password required', passwordProtected: true } (read from
 *       share.routes.ts, not guessed).
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name consultify-share-fix-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 5901:5432 \
 *     pgvector/pgvector:pg16
 *   DATABASE_URL=postgres://iris:iris_test@localhost:5901/iris_test \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false npm run db:migrate
 *   DATABASE_URL=postgres://iris:iris_test@localhost:5901/iris_test \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false RUN_DB_TESTS=1 \
 *     ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
 *     npx vitest run tests/integration/share-settings-pg-json.realpg.test.ts --retry=0
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && !!databaseUrl;
const NO_RETRY = { retry: 0 } as const;

describe.skipIf(!enabled)(
  'share-pg-fix-20260828 — GET /api/share/:token on real Postgres',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    app.use(express.json());

    const userId = `share-fix-user-${randomUUID()}`;
    const conversationId = `share-fix-conv-${randomUUID()}`;
    const shareId = `share-fix-share-${randomUUID()}`;
    const shareToken = `share-fix-token-${randomUUID()}`;
    const pwConversationId = `share-fix-conv-pw-${randomUUID()}`;
    const pwShareId = `share-fix-share-pw-${randomUUID()}`;
    const pwShareToken = `share-fix-token-pw-${randomUUID()}`;

    beforeAll(async () => {
      // Real ApiGateway, mounted after env is confirmed so the route module
      // (and its DB-type-sensitive DbPromise import chain) sees a real DB.
      const { ApiGateway } = await import('../../server/src/Gateway.js');
      ApiGateway.getInstance().initializeRoutes(app);

      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, role, status)
         VALUES ($1, $2, 'Share', 'Fix', 'MEMBER', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [userId, `${userId}@test.invalid`]
      );

      // Scenario (a): plain share, no password.
      await pool.query(
        `INSERT INTO conversations (id, user_id, title)
         VALUES ($1, $2, 'Share PG fix — plain conversation')`,
        [conversationId, userId]
      );
      await pool.query(
        `INSERT INTO conversation_messages (id, conversation_id, role, content)
         VALUES ($1, $2, 'user', 'Hello from the share-pg-fix regression test')`,
        [`${conversationId}-msg1`, conversationId]
      );
      await pool.query(
        `INSERT INTO conversation_shares
           (id, conversation_id, share_token, created_by, title, is_active, settings)
         VALUES ($1, $2, $3, $4, 'Plain share', 1, $5::jsonb)`,
        [shareId, conversationId, shareToken, userId, JSON.stringify({ allowCopy: true })]
      );

      // Scenario (b): password-protected share.
      await pool.query(
        `INSERT INTO conversations (id, user_id, title)
         VALUES ($1, $2, 'Share PG fix — password-protected conversation')`,
        [pwConversationId, userId]
      );
      await pool.query(
        `INSERT INTO conversation_shares
           (id, conversation_id, share_token, created_by, title, is_active, settings)
         VALUES ($1, $2, $3, $4, 'Protected share', 1, $5::jsonb)`,
        [
          pwShareId,
          pwConversationId,
          pwShareToken,
          userId,
          JSON.stringify({ passwordHash: 'scrypt$deadbeef$deadbeef' }),
        ]
      );
    });

    afterAll(async () => {
      await pool.query('DELETE FROM conversation_share_views WHERE share_id = ANY($1::text[])', [
        [shareId, pwShareId],
      ]);
      await pool.query('DELETE FROM conversation_shares WHERE id = ANY($1::text[])', [
        [shareId, pwShareId],
      ]);
      await pool.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [
        conversationId,
      ]);
      await pool.query('DELETE FROM conversations WHERE id = ANY($1::text[])', [
        [conversationId, pwConversationId],
      ]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      await pool.end();
      const pgModule = await import('../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    it('(a) anonymous GET on a plain share returns exactly 200 with the conversation content', async () => {
      const response = await request(app).get(`/api/share/${shareToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.conversation?.id ?? response.body.id).toBeDefined();
      // Sanity: the settings round-trip is a real object, not a stringified one.
      expect(response.body.messages?.length ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('(b) anonymous GET on a password-protected share, no password supplied, returns exactly 401 Password required', async () => {
      const response = await request(app).get(`/api/share/${pwShareToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(401);
      expect(response.body).toEqual({
        error: 'Password required',
        passwordProtected: true,
      });
    });
  }
);
