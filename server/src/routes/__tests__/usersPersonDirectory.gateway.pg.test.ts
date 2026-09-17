/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { sequential: true, retry: 0 } as const;

describe(
  'DEC-583 organization person directory through real ApiGateway and PostgreSQL',
  NO_RETRY,
  () => {
    const organizationId = randomUUID();
    const foreignOrganizationId = randomUUID();
    const memberId = randomUUID();
    const ownerId = randomUUID();
    const targetId = randomUUID();
    const foreignTargetId = randomUUID();
    const targetEmail = `private-${targetId}@example.test`;
    const targetPassword = `password-${targetId}`;

    let app: Express;
    let sql: Client;
    let memberAuthorization: string;
    let ownerAuthorization: string;

    const authorizationFor = (userId: string, role: 'MEMBER' | 'OWNER') =>
      `Bearer ${jwt.sign(
        {
          id: userId,
          userId,
          email: `${userId}@example.test`,
          organizationId,
          organization_id: organizationId,
          role,
        },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      )}`;

    beforeAll(async () => {
      process.env.DB_TYPE = 'postgres';
      expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
      await assertRealPostgresTestEnvironment();

      sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
      await sql.connect();

      for (const [id, name] of [
        [organizationId, 'DEC-583 directory organization'],
        [foreignOrganizationId, 'DEC-583 foreign organization'],
      ] as const) {
        await sql.query(
          `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
          [id, name]
        );
      }

      const users = [
        [memberId, organizationId, `member-${memberId}@example.test`, 'Member', 'Viewer', 'USER'],
        [ownerId, organizationId, `owner-${ownerId}@example.test`, 'Owner', 'Viewer', 'OWNER'],
        [targetId, organizationId, targetEmail, 'Visible', 'Person', 'USER'],
        [
          foreignTargetId,
          foreignOrganizationId,
          `foreign-${foreignTargetId}@example.test`,
          'Foreign',
          'Person',
          'USER',
        ],
      ] as const;
      for (const [id, orgId, email, firstName, lastName, role] of users) {
        await sql.query(
          `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', now())`,
          [id, orgId, email, targetPassword, firstName, lastName, role]
        );
      }

      for (const [userId, role] of [
        [memberId, 'MEMBER'],
        [ownerId, 'OWNER'],
        [targetId, 'MEMBER'],
        [foreignTargetId, 'MEMBER'],
      ] as const) {
        const orgId = userId === foreignTargetId ? foreignOrganizationId : organizationId;
        await sql.query(
          `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', now())`,
          [randomUUID(), orgId, userId, role]
        );
      }

      memberAuthorization = authorizationFor(memberId, 'MEMBER');
      ownerAuthorization = authorizationFor(ownerId, 'OWNER');
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
    }, 180_000);

    afterAll(async () => {
      if (!sql) return;
      await sql.query('DELETE FROM organization_members WHERE organization_id = ANY($1)', [
        [organizationId, foreignOrganizationId],
      ]);
      await sql.query('DELETE FROM users WHERE id = ANY($1)', [
        [memberId, ownerId, targetId, foreignTargetId],
      ]);
      await sql.query('DELETE FROM organizations WHERE id = ANY($1)', [
        [organizationId, foreignOrganizationId],
      ]);
      await sql.end();
    });

    it('returns a same-organization person to MEMBER without email, password, or MFA fields', async () => {
      const response = await request(app)
        .get(`/api/users/${targetId}`)
        .set('Authorization', memberAuthorization)
        .set('x-organization-id', organizationId);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body).toMatchObject({ id: targetId, displayName: 'Visible Person' });
      expect(response.body).not.toHaveProperty('email');
      expect(JSON.stringify(response.body)).not.toContain(targetEmail);
      expect(JSON.stringify(response.body)).not.toContain(targetPassword);
      expect(Object.keys(response.body).some((key) => /password|mfa/i.test(key))).toBe(false);
    });

    it('keeps /search reachable before /:id and returns selectable names without private fields to MEMBER', async () => {
      const response = await request(app)
        .get('/api/users/search?q=Visible&limit=8')
        .set('Authorization', memberAuthorization)
        .set('x-organization-id', organizationId);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: targetId,
            name: 'Visible Person',
            displayName: 'Visible Person',
          }),
        ])
      );
      expect(JSON.stringify(response.body)).not.toContain(targetEmail);
      expect(JSON.stringify(response.body)).not.toMatch(/password|mfa_secret|mfa_backup/i);
    });

    it('returns USERS_READ_FORBIDDEN for a person from another organization', async () => {
      const response = await request(app)
        .get(`/api/users/${foreignTargetId}`)
        .set('Authorization', memberAuthorization)
        .set('x-organization-id', organizationId);

      expect(response.status, JSON.stringify(response.body)).toBe(403);
      expect(response.body).toEqual({ error: 'USERS_READ_FORBIDDEN' });
    });

    it('allows OWNER to read email while never returning password or MFA fields', async () => {
      const response = await request(app)
        .get(`/api/users/${targetId}`)
        .set('Authorization', ownerAuthorization)
        .set('x-organization-id', organizationId);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.email).toBe(targetEmail);
      expect(JSON.stringify(response.body)).not.toContain(targetPassword);
      expect(Object.keys(response.body).some((key) => /password|mfa/i.test(key))).toBe(false);
    });
  }
);
