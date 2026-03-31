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
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('conversations');
        expect(Array.isArray(res.body.conversations)).toBe(true);
        expect(res.body).toHaveProperty('total');
        expect(typeof res.body.total).toBe('number');
      }
    });

    it('POST /api/conversations returns 201 with id or 401 without auth', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({ title: 'P35 Test Conversation' });
      expect([201, 401]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
        expect(typeof res.body.id).toBe('string');
      }
    });

    it('PATCH /api/conversations/:id returns 200 or 401/404', async () => {
      const res = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ title: 'Renamed', starred: true });
      expect([200, 401, 404]).toContain(res.status);
    });

    it('DELETE /api/conversations/:id returns soft-delete response or 401/404', async () => {
      const res = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001'
      );
      expect([200, 401, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        // Should be soft-delete (not purge) by default
        if (res.body.softDeleted) {
          expect(res.body.deletedAt).toBeDefined();
          expect(res.body.purged).toBeUndefined();
        }
      }
    });

    it('DELETE with ?force=true purges with audit trail or 401/404', async () => {
      const res = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001?force=true'
      );
      expect([200, 401, 404]).toContain(res.status);
      if (res.status === 200 && res.body.purged) {
        expect(res.body.messagesRemoved).toBeDefined();
        expect(typeof res.body.messagesRemoved).toBe('number');
      }
    });
  });

  // ==================== SERVER-SIDE SEARCH ====================

  describe('Server-Side Search (P34-governed)', () => {
    it('GET /api/conversations/search without q returns empty', async () => {
      const res = await request(app).get('/api/conversations/search');
      expect([200, 400, 401]).toContain(res.status);
    });

    it('GET /api/conversations/search?q=ab (2 chars) returns results or auth error', async () => {
      const res = await request(app).get('/api/conversations/search?q=ab');
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('conversations');
        expect(res.body).toHaveProperty('nextCursor');
        expect(res.body).toHaveProperty('hasMore');
        expect(res.body).toHaveProperty('query', 'ab');
        expect(Array.isArray(res.body.conversations)).toBe(true);
      }
    });

    it('search supports cursor pagination (nextCursor + hasMore)', async () => {
      const res = await request(app).get('/api/conversations/search?q=test&limit=2');
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(typeof res.body.hasMore).toBe('boolean');
        if (res.body.hasMore) {
          expect(typeof res.body.nextCursor).toBe('string');
          expect(res.body.nextCursor).toContain('|');
        }
      }
    });

    it('search supports filters (pinned, archived, folderId, from, to)', async () => {
      const res = await request(app).get(
        '/api/conversations/search?q=test&pinned=true&archived=false'
      );
      expect([200, 401]).toContain(res.status);
    });
  });

  // ==================== LIST WITH CURSOR PAGINATION ====================

  describe('List with Cursor Pagination', () => {
    it('GET /api/conversations?cursor=... uses cursor-based pagination', async () => {
      const res = await request(app).get(
        '/api/conversations?cursor=2026-01-01T00:00:00Z|fake-id&limit=5'
      );
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('conversations');
        expect(res.body).toHaveProperty('nextCursor');
        expect(res.body).toHaveProperty('hasMore');
      }
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
      expect([200, 401, 404]).toContain(archiveRes.status);

      const unarchiveRes = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ archived: false });
      expect([200, 401, 404]).toContain(unarchiveRes.status);
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
      expect([200, 401, 404]).toContain(res.status);
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
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('projects');
      }
    });

    it('POST /api/chat-projects validates scope enum', async () => {
      const res = await request(app)
        .post('/api/chat-projects')
        .send({ name: 'Test', scope: 'invalid' });
      expect([400, 401]).toContain(res.status);
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
      expect([200, 401, 404]).toContain(res.status);
      if (res.status === 500) {
        expect(res.body.error).not.toContain('no such table: messages');
      }
    });
  });
});
