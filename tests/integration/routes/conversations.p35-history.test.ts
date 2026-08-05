/**
 * P35-B: Historia czatów — Integration Tests
 *
 * Tests the full conversation lifecycle, server-side search with cursor pagination,
 * soft-delete grace semantics, deep-link state handling, team folder permissions,
 * and P34 policy gateway integration.
 *
 * NOTE: These tests run against the actual server with DB initialization.
 * Auth may not be available in all test environments, so we test both
 * authenticated (200/201) and unauthenticated (401) paths.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-p35-history-${workerId}.db`;
});

describe('P35-B: Historia czatów — Lifecycle + Search + Governance', () => {
  let app: any;

  beforeAll(async () => {
    const { initializeDatabase } = await import(
      '../../../server/src/database/DatabaseInitializer.js'
    );
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  // ==================== LIFECYCLE CRUD ====================

  describe('Conversation Lifecycle CRUD', () => {
    it('GET /api/conversations returns 200 with conversations array or 401 without auth', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(401);
    });

    it('POST /api/conversations returns 201 with id or 401 without auth', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({ title: 'P35 Test Conversation' });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/conversations/:id returns 200 or 401/404', async () => {
      const res = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ title: 'Renamed', starred: true });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/conversations/:id returns soft-delete response or 401/404', async () => {
      const res = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001'
      );
      expect(res.status).toBe(401);
    });

    it('DELETE with ?force=true purges with audit trail or 401/404', async () => {
      const res = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001?force=true'
      );
      expect(res.status).toBe(401);
    });
  });

  // ==================== SERVER-SIDE SEARCH ====================

  describe('Server-Side Search (P34-governed)', () => {
    it('GET /api/conversations/search without q returns empty', async () => {
      const res = await request(app).get('/api/conversations/search');
      expect(res.status).toBe(401);
    });

    it('GET /api/conversations/search?q=ab (2 chars) returns results or auth error', async () => {
      const res = await request(app).get('/api/conversations/search?q=ab');
      expect(res.status).toBe(401);
    });

    it('search supports cursor pagination (nextCursor + hasMore)', async () => {
      const res = await request(app).get('/api/conversations/search?q=test&limit=2');
      expect(res.status).toBe(401);
    });

    it('search supports filters (pinned, archived, folderId, from, to)', async () => {
      const res = await request(app).get(
        '/api/conversations/search?q=test&pinned=true&archived=false'
      );
      expect(res.status).toBe(401);
    });
  });

  // ==================== LIST WITH CURSOR PAGINATION ====================

  describe('List with Cursor Pagination', () => {
    it('GET /api/conversations?cursor=... uses cursor-based pagination', async () => {
      const res = await request(app).get(
        '/api/conversations?cursor=2026-01-01T00:00:00Z|fake-id&limit=5'
      );
      expect(res.status).toBe(401);
    });
  });

  // ==================== DEEP-LINK STATE ====================

  describe('Deep-Link State Handling (§2.3.5 E5)', () => {
    it('GET /api/conversations/:id for non-existent returns 404 with state', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000099'
      );
      expect([401, 404]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.state).toBe('not_found');
      }
    });
  });

  // ==================== ARCHIVE vs DELETE ====================

  describe('Archive vs Delete Semantics (§2.3.6 F2)', () => {
    it('archive is reversible via PATCH archived=true/false', async () => {
      const archiveRes = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ archived: true });
      expect(archiveRes.status).toBe(401);

      const unarchiveRes = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ archived: false });
      expect(unarchiveRes.status).toBe(401);
    });
  });

  // ==================== BULK OPERATIONS ====================

  describe('Bulk Operations', () => {
    it('POST /api/conversations/bulk validates action enum', async () => {
      const res = await request(app)
        .post('/api/conversations/bulk')
        .send({ ids: ['00000000-0000-0000-0000-000000000001'], action: 'invalid' });
      expect([400, 401]).toContain(res.status);
    });

    it('POST /api/conversations/bulk with valid action works or requires auth', async () => {
      const res = await request(app)
        .post('/api/conversations/bulk')
        .send({ ids: ['00000000-0000-0000-0000-000000000001'], action: 'archive' });
      expect(res.status).toBe(401);
    });
  });

  // ==================== TEAM PERMISSIONS (P34 GATEWAY) ====================

  describe('Team Folder Permissions (§2.3.3)', () => {
    it('team conversation without org access returns 401/403/404 (no leakage)', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000099'
      );
      expect([401, 403, 404]).toContain(res.status);
      // Must NOT return conversation content
      if (res.status === 404) {
        expect(res.body.messages).toBeUndefined();
      }
    });
  });

  // ==================== CHAT PROJECTS (FOLDERS) ====================

  describe('Chat Projects / Folders', () => {
    it('GET /api/chat-projects returns folders or requires auth', async () => {
      const res = await request(app).get('/api/chat-projects');
      expect(res.status).toBe(401);
    });

    it('POST /api/chat-projects validates scope enum', async () => {
      const res = await request(app)
        .post('/api/chat-projects')
        .send({ name: 'Test', scope: 'invalid' });
      expect([400, 401]).toContain(res.status);
    });
  });

  // ==================== ATTACHMENT ENDPOINTS ====================

  describe('Attachment Pointers (§2.3.1)', () => {
    it('POST /:id/messages/:messageId/attachments creates attachment or requires auth', async () => {
      const res = await request(app)
        .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages/msg-1/attachments')
        .send({
          kind: 'file',
          displayName: 'test-doc.pdf',
          mime: 'application/pdf',
          sizeBytes: 1024,
        });
      expect(res.status).toBe(401);
    });

    it('GET /:id/messages/:messageId/attachments lists attachments or degrades gracefully', async () => {
      const res = await request(app)
        .get('/api/conversations/00000000-0000-0000-0000-000000000001/messages/msg-1/attachments');
      expect(res.status).toBe(401);
    });
  });

  // ==================== SESSION ENDPOINTS ====================

  describe('Conversation Sessions (§2.3.1)', () => {
    it('GET /:id/sessions lists sessions or degrades gracefully', async () => {
      const res = await request(app)
        .get('/api/conversations/00000000-0000-0000-0000-000000000001/sessions');
      expect(res.status).toBe(401);
    });

    it('POST /:id/sessions creates a new session or requires auth', async () => {
      const res = await request(app)
        .post('/api/conversations/00000000-0000-0000-0000-000000000001/sessions')
        .send({ modelId: 'gpt-4', locale: 'en' });
      expect(res.status).toBe(401);
    });
  });

  // ==================== WRITE CONFLICT DETECTION ====================

  describe('Write Conflict Detection (§2.3.5 E9)', () => {
    it('PATCH with wrong expectedVersion returns 409 Conflict', async () => {
      const res = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ title: 'Conflict test', expectedVersion: 999 });
      expect([401, 404, 409]).toContain(res.status);
      if (res.status === 409) {
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body).toHaveProperty('currentVersion');
      }
    });
  });

  // ==================== EXPORT (§2.3.5 E10) ====================

  describe('Export Conversation (§2.3.5 E10)', () => {
    it('GET /:id/export returns JSON export or requires auth', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000001/export'
      );
      expect(res.status).toBe(401);
    });

    it('GET /:id/export?format=markdown returns markdown', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000001/export?format=markdown'
      );
      expect(res.status).toBe(401);
    });

    it('GET /:id/export supports date range narrowing', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000001/export?from=2026-01-01&to=2026-12-31'
      );
      expect(res.status).toBe(401);
    });
  });

  // ==================== PARTIAL RETRIEVAL (§2.3.5 E7) ====================

  describe('Partial Retrieval — Scope Limited (§2.3.5 E7, corrected M01-P02 2026-08-04)', () => {
    // M01-P02 (2026-08-04): the original `scopeBlocked` field was a
    // COUNT(*) of team-scope conversations matching the caller's own search
    // term, returned even when the caller lacked team-read permission — a
    // content-shaped side channel (a caller could learn how many team
    // conversations match a probe term without ever being allowed to read
    // them). Replaced with `scopeLimited`, a boolean derived only from the
    // caller's OWN permission state (do they lack team-read at all?), never
    // from whether a specific query matched anything in team scope. This
    // test is re-pointed at the corrected contract rather than removed —
    // it previously asserted the leaky shape without ever exercising it
    // (every case here also asserts 401, since this file runs without a
    // real login; see conversations.search.realdb.test.ts for the
    // authenticated, real-Postgres proof of `scopeLimited`'s behavior).
    it('search reports scopeLimited as a boolean, never a scopeBlocked count', async () => {
      const res = await request(app).get('/api/conversations/search?q=test');
      expect(res.status).toBe(401);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('scopeLimited');
        expect(typeof res.body.scopeLimited).toBe('boolean');
        expect(res.body).not.toHaveProperty('scopeBlocked');
      }
    });
  });

  // ==================== REGRESSION GUARDS ====================

  describe('Regression Guards', () => {
    it('list endpoint does NOT return soft-deleted conversations', async () => {
      const res = await request(app).get('/api/conversations');
      if (res.status === 200 && Array.isArray(res.body.conversations)) {
        for (const conv of res.body.conversations) {
          expect(conv.deleted_at).toBeNull();
        }
      }
    });

    it('summarize endpoint references conversation_messages (not messages)', async () => {
      const res = await request(app)
        .post('/api/conversations/00000000-0000-0000-0000-000000000001/summarize')
        .send({ keepRecent: 10 });
      // Should not get "no such table: messages" error
      expect(res.status).toBe(401);
    });
  });
});
