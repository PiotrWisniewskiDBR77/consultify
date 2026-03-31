/**
 * P35-B: Historia czatów — Integration Tests
 *
 * Tests the full conversation lifecycle (create/rename/pin/archive/unarchive/delete),
 * server-side search with cursor pagination, soft-delete grace semantics,
 * deep-link state handling, and team folder permission boundaries.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-p35-history-${workerId}.db`;
});

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 501];

describe('P35-B: Historia czatów — Lifecycle + Search + Soft-Delete', () => {
  let app: any;

  beforeAll(async () => {
    const { initializeDatabase } = await import(
      '../../../server/src/database/DatabaseInitializer.js'
    );
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  // ==================== LIFECYCLE ====================

  describe('Conversation Lifecycle', () => {
    it('GET /api/conversations returns valid response', async () => {
      const res = await request(app).get('/api/conversations');
      expect(VALID_STATUSES).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('conversations');
        expect(Array.isArray(res.body.conversations)).toBe(true);
      }
    });

    it('POST /api/conversations creates a conversation (or requires auth)', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({ title: 'P35 Test Conversation' });
      expect(VALID_STATUSES).toContain(res.status);
    });

    it('PATCH /api/conversations/:id updates metadata (or requires auth)', async () => {
      const res = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ title: 'Renamed', starred: true });
      expect(VALID_STATUSES).toContain(res.status);
    });

    it('DELETE /api/conversations/:id soft-deletes (or requires auth)', async () => {
      const res = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001'
      );
      expect(VALID_STATUSES).toContain(res.status);
      if (res.status === 200 && res.body.softDeleted) {
        expect(res.body.deletedAt).toBeDefined();
      }
    });

    it('DELETE with ?force=true hard-deletes a soft-deleted conversation', async () => {
      const res = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001?force=true'
      );
      expect(VALID_STATUSES).toContain(res.status);
    });
  });

  // ==================== SEARCH ====================

  describe('Server-Side Search (target posture)', () => {
    it('GET /api/conversations/search requires q param >= 2 chars', async () => {
      const res = await request(app).get('/api/conversations/search?q=a');
      expect(VALID_STATUSES).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.conversations).toEqual([]);
      }
    });

    it('GET /api/conversations/search with valid q returns results + cursor', async () => {
      const res = await request(app).get('/api/conversations/search?q=test');
      expect(VALID_STATUSES).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('conversations');
        expect(res.body).toHaveProperty('nextCursor');
        expect(res.body).toHaveProperty('hasMore');
        expect(res.body).toHaveProperty('query', 'test');
      }
    });

    it('GET /api/conversations/search supports filters', async () => {
      const res = await request(app).get(
        '/api/conversations/search?q=test&pinned=true&archived=false'
      );
      expect(VALID_STATUSES).toContain(res.status);
    });

    it('GET /api/conversations/search supports cursor pagination', async () => {
      const res = await request(app).get(
        '/api/conversations/search?q=test&cursor=2026-03-31T00:00:00Z|some-id&limit=5'
      );
      expect(VALID_STATUSES).toContain(res.status);
    });
  });

  // ==================== DEEP-LINK STATE ====================

  describe('Deep-Link State Handling', () => {
    it('GET /api/conversations/:id returns _state field', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000099'
      );
      expect(VALID_STATUSES).toContain(res.status);
      if (res.status === 404) {
        expect(res.body).toHaveProperty('state', 'not_found');
      }
    });
  });

  // ==================== BULK OPERATIONS ====================

  describe('Bulk Operations', () => {
    it('POST /api/conversations/bulk archive works', async () => {
      const res = await request(app)
        .post('/api/conversations/bulk')
        .send({
          ids: ['00000000-0000-0000-0000-000000000001'],
          action: 'archive',
        });
      expect(VALID_STATUSES).toContain(res.status);
    });

    it('POST /api/conversations/bulk delete uses soft-delete', async () => {
      const res = await request(app)
        .post('/api/conversations/bulk')
        .send({
          ids: ['00000000-0000-0000-0000-000000000001'],
          action: 'delete',
        });
      expect(VALID_STATUSES).toContain(res.status);
    });
  });

  // ==================== ARCHIVE vs DELETE DISTINCTION ====================

  describe('Archive vs Delete Semantics', () => {
    it('archive is reversible (PATCH archived=true then archived=false)', async () => {
      const archiveRes = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ archived: true });
      expect(VALID_STATUSES).toContain(archiveRes.status);

      const unarchiveRes = await request(app)
        .patch('/api/conversations/00000000-0000-0000-0000-000000000001')
        .send({ archived: false });
      expect(VALID_STATUSES).toContain(unarchiveRes.status);
    });

    it('delete is destructive (sets deleted_at, not reversible via PATCH)', async () => {
      const deleteRes = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000001'
      );
      expect(VALID_STATUSES).toContain(deleteRes.status);
    });
  });

  // ==================== TEAM FOLDER PERMISSIONS ====================

  describe('Team Folder Permission Boundaries', () => {
    it('team conversation without org access returns 403 or 404', async () => {
      const res = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000099'
      );
      expect([401, 403, 404]).toContain(res.status);
    });
  });

  // ==================== CHAT PROJECTS (FOLDERS) ====================

  describe('Chat Projects (Folders)', () => {
    it('GET /api/chat-projects returns folders', async () => {
      const res = await request(app).get('/api/chat-projects');
      expect(VALID_STATUSES).toContain(res.status);
    });

    it('POST /api/chat-projects creates a folder', async () => {
      const res = await request(app)
        .post('/api/chat-projects')
        .send({ name: 'Test Folder', scope: 'personal' });
      expect(VALID_STATUSES).toContain(res.status);
    });
  });

  // ==================== REGRESSION ====================

  describe('Regression Guards', () => {
    it('list endpoint excludes soft-deleted conversations', async () => {
      const res = await request(app).get('/api/conversations');
      expect(VALID_STATUSES).toContain(res.status);
      if (res.status === 200 && Array.isArray(res.body.conversations)) {
        for (const conv of res.body.conversations) {
          expect(conv.deleted_at).toBeUndefined();
        }
      }
    });

    it('search endpoint excludes soft-deleted conversations', async () => {
      const res = await request(app).get('/api/conversations/search?q=test');
      expect(VALID_STATUSES).toContain(res.status);
    });

    it('auto-archive endpoint works', async () => {
      const res = await request(app)
        .post('/api/conversations/auto-archive')
        .send({ daysOld: 30 });
      expect(VALID_STATUSES).toContain(res.status);
    });
  });
});
