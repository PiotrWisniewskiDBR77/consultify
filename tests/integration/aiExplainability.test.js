/**
 * @vitest-environment node
 * AI Explainability API Integration Tests
 * 
 * Step 15: Explainability Ledger & Evidence Pack
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server/index.js');
const db = require('../../server/database.js');
const bcrypt = require('bcryptjs');

describe('AI Explainability API Integration', () => {
    let adminToken;
    let adminId = 'test-admin-explain-v1';
    let orgId = 'test-org-explain-v1';

    beforeAll(async () => {
        await db.initPromise;

        // Setup test org and user
        const hashedPassword = bcrypt.hashSync('password123', 8);

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [orgId, 'Test Org Explain', 'enterprise', 'active'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [adminId, orgId, 'admin-explain@test.com', hashedPassword, 'Admin', 'Explain', 'ADMIN'], resolve);
        });

        // Get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin-explain@test.com', password: 'password123' });

        adminToken = res.body.token;
    });

    afterAll(async () => {
        // Cleanup
        await new Promise((resolve) => {
            db.run(`DELETE FROM ai_evidence_objects WHERE org_id = ?`, [orgId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [adminId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [orgId], resolve);
        });
    });

    describe('GET /api/ai/explain/:entityType/:id - Access Control', () => {
        it('should block unauthorized users (no token)', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/test-id');

            expect(res.status).toBe(403);
        });

        it('should reject invalid entity types', async () => {
            const res = await request(app)
                .get('/api/ai/explain/invalid_type/test-id')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid entityType');
        });

        it('should return empty explanation for non-existent entity', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/non-existent-id')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_explanation).toBe(false);
            expect(res.body.evidence_count).toBe(0);
        });
    });

    describe('GET /api/ai/explain/:entityType/:id/export - Export', () => {
        it('should block unauthorized users', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/test-id/export');

            expect(res.status).toBe(403);
        });

        it('should reject invalid format', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/test-id/export?format=invalid')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid format');
        });

        it('should return JSON export with correct structure', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/test-id/export?format=json')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('metadata');
            expect(res.body).toHaveProperty('summary');
            expect(res.body).toHaveProperty('reasoning');
            expect(res.body).toHaveProperty('evidences');
            expect(res.body.metadata.format).toBe('json');
        });

        it('should include render_options for PDF format', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/test-id/export?format=pdf')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('render_options');
            expect(res.body.metadata.format).toBe('pdf');
        });
    });

    describe('POST /api/ai/explain/:entityType/:id/export/pdf - PDF Export', () => {
        it('should block unauthorized users', async () => {
            const res = await request(app)
                .post('/api/ai/explain/decision/test-id/export/pdf');

            expect(res.status).toBe(403);
        });

        it('should return PDF-ready JSON', async () => {
            const res = await request(app)
                .post('/api/ai/explain/decision/test-id/export/pdf')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('render_options');
        });
    });

    describe('GET /api/ai/explain/:entityType/:id/has-evidence - Evidence Check', () => {
        it('should return has_evidence: false for entity without evidence', async () => {
            const res = await request(app)
                .get('/api/ai/explain/decision/no-evidence-id/has-evidence')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_evidence).toBe(false);
        });
    });
});

describe('AI Explainability - Organization Isolation', () => {
    let admin1Token, admin2Token;
    let admin1Id = 'test-admin-iso1';
    let admin2Id = 'test-admin-iso2';
    let org1Id = 'test-org-iso1';
    let org2Id = 'test-org-iso2';

    beforeAll(async () => {
        await db.initPromise;

        const hashedPassword = bcrypt.hashSync('password123', 8);

        // Create two orgs with admins
        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [org1Id, 'Org Iso 1', 'enterprise', 'active'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [org2Id, 'Org Iso 2', 'enterprise', 'active'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [admin1Id, org1Id, 'admin-iso1@test.com', hashedPassword, 'Admin1', 'Iso', 'ADMIN'], resolve);
        });

        await new Promise((resolve) => {
            db.run(`INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, last_name, role) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [admin2Id, org2Id, 'admin-iso2@test.com', hashedPassword, 'Admin2', 'Iso', 'ADMIN'], resolve);
        });

        // Get tokens
        const res1 = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin-iso1@test.com', password: 'password123' });
        admin1Token = res1.body.token;

        const res2 = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin-iso2@test.com', password: 'password123' });
        admin2Token = res2.body.token;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            db.run(`DELETE FROM ai_evidence_objects WHERE org_id IN (?, ?)`, [org1Id, org2Id], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id IN (?, ?)`, [admin1Id, admin2Id], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id IN (?, ?)`, [org1Id, org2Id], resolve);
        });
    });

    it('should isolate evidence by organization', async () => {
        // Both admins should only see their org's (empty) evidences
        const res1 = await request(app)
            .get('/api/ai/explain/decision/shared-id')
            .set('Authorization', `Bearer ${admin1Token}`);

        const res2 = await request(app)
            .get('/api/ai/explain/decision/shared-id')
            .set('Authorization', `Bearer ${admin2Token}`);

        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);

        // Both should get empty results (no cross-org leakage)
        expect(res1.body.evidence_count).toBe(0);
        expect(res2.body.evidence_count).toBe(0);
    });
});
