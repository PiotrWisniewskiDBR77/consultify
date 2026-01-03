/**
 * TEMPLATE: Route Integration Test
 * 
 * Ten plik służy jako szablon do tworzenia testów integracyjnych tras API.
 * Skopiuj i dostosuj do konkretnej trasy.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { initTestDb, cleanTables, closeDb } from '../../helpers/dbHelper.cjs';

// Mock external services that shouldn't be called in tests
vi.mock('../../server/services/emailService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../server/services/aiService.js', () => ({
  generateResponse: vi.fn().mockResolvedValue({ content: 'Mock AI response' }),
}));

// Dynamic import for app to ensure fresh state
let app;

describe('API Route: /api/resource', () => {
  let authToken;
  let testUser;
  let testOrg;

  beforeAll(async () => {
    // Initialize test database
    await initTestDb();
    
    // Import app after database is ready
    const module = await import('../../server/index.js');
    app = module.default;
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    // Seed test data
    const db = (await import('../../server/database.js')).default;
    
    // Create test organization
    await db.run(`
      INSERT INTO organizations (id, name, slug, plan_type, created_at)
      VALUES (1, 'Test Org', 'test-org', 'pro', datetime('now'))
    `);
    testOrg = { id: 1, name: 'Test Org' };

    // Create test user
    const hashedPassword = '$2a$10$test-hash'; // Pre-computed hash for 'password123'
    await db.run(`
      INSERT INTO users (id, email, password_hash, org_id, role, created_at)
      VALUES (1, 'test@example.com', ?, 1, 'admin', datetime('now'))
    `, [hashedPassword]);
    
    testUser = { id: 1, email: 'test@example.com', orgId: 1, role: 'admin' };

    // Get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    authToken = loginRes.body.token;
  });

  afterEach(async () => {
    await cleanTables();
    vi.clearAllMocks();
  });

  // ===== GET Endpoints =====
  
  describe('GET /api/resource', () => {
    it('returns 200 and list of resources for authenticated user', async () => {
      const response = await request(app)
        .get('/api/resource')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('returns 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/resource');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('supports pagination', async () => {
      // Seed multiple items
      const db = (await import('../../server/database.js')).default;
      for (let i = 0; i < 25; i++) {
        await db.run(`
          INSERT INTO resources (name, org_id, created_at)
          VALUES (?, 1, datetime('now'))
        `, [`Resource ${i}`]);
      }

      const response = await request(app)
        .get('/api/resource?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('filters by status parameter', async () => {
      const db = (await import('../../server/database.js')).default;
      await db.run(`INSERT INTO resources (name, status, org_id) VALUES ('Active 1', 'active', 1)`);
      await db.run(`INSERT INTO resources (name, status, org_id) VALUES ('Active 2', 'active', 1)`);
      await db.run(`INSERT INTO resources (name, status, org_id) VALUES ('Inactive 1', 'inactive', 1)`);

      const response = await request(app)
        .get('/api/resource?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(item => {
        expect(item.status).toBe('active');
      });
    });

    it('respects organization isolation', async () => {
      const db = (await import('../../server/database.js')).default;
      
      // Create another org with resources
      await db.run(`INSERT INTO organizations (id, name, slug) VALUES (2, 'Other Org', 'other')`);
      await db.run(`INSERT INTO resources (name, org_id) VALUES ('Other Resource', 2)`);
      await db.run(`INSERT INTO resources (name, org_id) VALUES ('My Resource', 1)`);

      const response = await request(app)
        .get('/api/resource')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('My Resource');
    });
  });

  describe('GET /api/resource/:id', () => {
    it('returns 200 and resource details', async () => {
      const db = (await import('../../server/database.js')).default;
      await db.run(`INSERT INTO resources (id, name, org_id) VALUES (1, 'Test Resource', 1)`);

      const response = await request(app)
        .get('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Test Resource',
      });
    });

    it('returns 404 for non-existent resource', async () => {
      const response = await request(app)
        .get('/api/resource/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });

    it('returns 403 for resource from different org', async () => {
      const db = (await import('../../server/database.js')).default;
      await db.run(`INSERT INTO organizations (id, name, slug) VALUES (2, 'Other Org', 'other')`);
      await db.run(`INSERT INTO resources (id, name, org_id) VALUES (1, 'Other Resource', 2)`);

      const response = await request(app)
        .get('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ===== POST Endpoints =====

  describe('POST /api/resource', () => {
    const validPayload = {
      name: 'New Resource',
      description: 'Test description',
      type: 'standard',
    };

    it('creates resource and returns 201', async () => {
      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'New Resource',
        description: 'Test description',
      });
      expect(response.body.id).toBeDefined();
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Missing name' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/name.*required/i);
    });

    it('validates field formats', async () => {
      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validPayload, type: 'invalid-type' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/type/i);
    });

    it('sanitizes input to prevent XSS', async () => {
      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          ...validPayload, 
          name: '<script>alert("xss")</script>Test' 
        });

      expect(response.status).toBe(201);
      expect(response.body.name).not.toContain('<script>');
    });

    it('enforces unique constraint', async () => {
      await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPayload);

      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPayload);

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/already exists/i);
    });

    it('assigns resource to user org', async () => {
      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.org_id).toBe(testOrg.id);
    });
  });

  // ===== PUT/PATCH Endpoints =====

  describe('PUT /api/resource/:id', () => {
    beforeEach(async () => {
      const db = (await import('../../server/database.js')).default;
      await db.run(`
        INSERT INTO resources (id, name, description, org_id, created_at)
        VALUES (1, 'Original Name', 'Original Desc', 1, datetime('now'))
      `);
    });

    it('updates resource and returns 200', async () => {
      const response = await request(app)
        .put('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name', description: 'Updated Desc' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Updated Name',
        description: 'Updated Desc',
      });
    });

    it('returns 404 for non-existent resource', async () => {
      const response = await request(app)
        .put('/api/resource/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('validates update payload', async () => {
      const response = await request(app)
        .put('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }); // Empty name invalid

      expect(response.status).toBe(400);
    });
  });

  // ===== DELETE Endpoints =====

  describe('DELETE /api/resource/:id', () => {
    beforeEach(async () => {
      const db = (await import('../../server/database.js')).default;
      await db.run(`
        INSERT INTO resources (id, name, org_id)
        VALUES (1, 'To Delete', 1)
      `);
    });

    it('deletes resource and returns 204', async () => {
      const response = await request(app)
        .delete('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app)
        .get('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('returns 404 for non-existent resource', async () => {
      const response = await request(app)
        .delete('/api/resource/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('handles cascade deletion', async () => {
      const db = (await import('../../server/database.js')).default;
      // Create related records
      await db.run(`INSERT INTO resource_items (resource_id, name) VALUES (1, 'Item 1')`);

      const response = await request(app)
        .delete('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify related items deleted
      const items = await db.all(`SELECT * FROM resource_items WHERE resource_id = 1`);
      expect(items).toHaveLength(0);
    });
  });

  // ===== RBAC & Permissions =====

  describe('Role-Based Access Control', () => {
    it('allows admin to access all endpoints', async () => {
      const response = await request(app)
        .get('/api/resource')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('restricts user role from admin endpoints', async () => {
      // Create user with 'user' role
      const db = (await import('../../server/database.js')).default;
      await db.run(`
        INSERT INTO users (id, email, password_hash, org_id, role)
        VALUES (2, 'user@example.com', '$2a$10$test-hash', 1, 'user')
      `);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' });

      const userToken = loginRes.body.token;

      const response = await request(app)
        .delete('/api/resource/1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ===== Error Handling =====

  describe('Error Handling', () => {
    it('returns 500 for database errors', async () => {
      // Force database error by closing connection
      const db = (await import('../../server/database.js')).default;
      vi.spyOn(db, 'get').mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/api/resource/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toMatch(/internal server error/i);
    });

    it('handles malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
});









