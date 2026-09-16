/** @vitest-environment node */
/**
 * [ODMROZENIE 11_MATERIALS DEC-575]
 * FEEDBACK-1 1a — a table is tenant-owned through tp_bases.organization_id,
 * not limited to tp_bases.created_by. The HTTP boundary must admit another
 * ADMIN from the same organization and deny the same id cross-organization.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(databaseUrl) &&
  /localhost|127\.0\.0\.1/.test(databaseUrl);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.ENABLE_TABLE_PLATFORM_RECORDS_API = 'true';
delete process.env.ENABLE_TEST_AUTH_BYPASS;
const jwtSecret = 'feedback-1a-real-auth-secret-at-least-32-characters';
process.env.JWT_SECRET = jwtSecret;
const tableAccessDeniedMessage = 'Access denied to this table';
const artifactNotFoundMessage = 'Artifact not found';

describe.skipIf(!enabled)(
  'FEEDBACK-1 1a — Materials sheet ADMIN organization access (real PostgreSQL + HTTP)',
  () => {
    const prefix = `feedback-1a-${randomUUID()}`;
    const orgA = `${prefix}-org-a`;
    const orgB = `${prefix}-org-b`;
    const ownerA = `${prefix}-owner-a`;
    const adminA = `${prefix}-admin-a`;
    const adminB = `${prefix}-admin-b`;
    const baseId = randomUUID();
    const tableId = randomUUID();
    const tableArtifactId = randomUUID();
    const tableOriginLinkId = randomUUID();
    const workbookId = randomUUID();
    const workbookArtifactId = randomUUID();
    const workbookOriginLinkId = randomUUID();
    let pool: Pool;
    let app: express.Express;

    const bearer = (userId: string, organizationId: string) => ({
      Authorization: `Bearer ${jwt.sign(
        {
          id: userId,
          userId,
          email: `${userId}@example.test`,
          organizationId,
          organization_id: organizationId,
          role: 'ADMIN',
        },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      )}`,
      'x-org-context': organizationId,
    });

    beforeAll(async () => {
      pool = new Pool({ connectionString: databaseUrl, max: 2 });
      const dbName = String((await pool.query('SELECT current_database() AS name')).rows[0]?.name);
      if (!dbName.startsWith('consultify_feedback_')) {
        throw new Error(`FEEDBACK_1A_REQUIRES_DISPOSABLE_DATABASE:${dbName}`);
      }

      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, $3),
                ($4, $5, 'enterprise', 'active', 1, $3)`,
        [orgA, `${prefix} Organization A`, now, orgB, `${prefix} Organization B`]
      );
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
         VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', $7),
                ($4, $2, $5, 'unused', 'ADMIN', 'active', $7),
                ($6, $8, $9, 'unused', 'ADMIN', 'active', $7)`,
        [
          ownerA,
          orgA,
          `${ownerA}@example.test`,
          adminA,
          `${adminA}@example.test`,
          adminB,
          now,
          orgB,
          `${adminB}@example.test`,
        ]
      );
      await pool.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $10),
                ($4, $2, $5, 'ADMIN', 'ACTIVE', $10),
                ($6, $7, $8, 'ADMIN', 'ACTIVE', $10),
                ($9, $7, $3, 'ADMIN', 'ACTIVE', $10)`,
        [
          `${prefix}-membership-owner-a`,
          orgA,
          ownerA,
          `${prefix}-membership-admin-a`,
          adminA,
          `${prefix}-membership-admin-b`,
          orgB,
          adminB,
          `${prefix}-membership-owner-b`,
          now,
        ]
      );

      await pool.query(
        `INSERT INTO tp_bases
           (id, workspace_id, organization_id, name, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [baseId, `${prefix}-workspace`, orgA, 'Organization sheets', ownerA]
      );
      await pool.query(
        `INSERT INTO tp_tables (id, base_id, name, created_by)
         VALUES ($1, $2, $3, $4)`,
        [tableId, baseId, 'Supplier scorecard', ownerA]
      );
      await pool.query(
        `INSERT INTO v8_output_artifacts
           (artifact_id, organization_id, output_type, artifact_family,
            delivery_state, title_snapshot, owner_user_id, visibility_scope,
            created_by, created_at, last_transition_at, origin_summary_json)
         VALUES ($1, $2, 'sheet', 'sheet', 'ready', $3, $4,
                 'organization', $4, $5, $5, $6)`,
        [
          tableArtifactId,
          orgA,
          'Supplier scorecard',
          ownerA,
          now,
          JSON.stringify({ sourceTable: 'tp_tables', governanceMode: 'governed' }),
        ]
      );
      await pool.query(
        `INSERT INTO v8_artifact_origin_links
           (link_id, artifact_id, organization_id, origin_runtime,
            origin_record_id, is_primary_origin, created_at)
         VALUES ($1, $2, $3, 'sheet', $4, 1, $5)`,
        [tableOriginLinkId, tableArtifactId, orgA, tableId, now]
      );
      await pool.query(
        `INSERT INTO generated_workbooks
           (id, organization_id, title, schema_json, sheet_count, created_by, version)
         VALUES ($1, $2, $3, $4, 2, $5, 0)`,
        [
          workbookId,
          orgA,
          'Generated operating workbook',
          JSON.stringify({ sheets: [{ name: 'Summary', rows: [] }, { name: 'Plan', rows: [] }] }),
          ownerA,
        ]
      );
      await pool.query(
        `INSERT INTO v8_output_artifacts
           (artifact_id, organization_id, output_type, artifact_family,
            delivery_state, title_snapshot, owner_user_id, visibility_scope,
            created_by, created_at, last_transition_at, origin_summary_json)
         VALUES ($1, $2, 'sheet', 'sheet', 'ready', $3, $4,
                 'organization', $4, $5, $5, $6)`,
        [
          workbookArtifactId,
          orgA,
          'Generated operating workbook',
          ownerA,
          now,
          JSON.stringify({ sheetCount: 2, source: 'workbook-generator' }),
        ]
      );
      await pool.query(
        `INSERT INTO v8_artifact_origin_links
           (link_id, artifact_id, organization_id, origin_runtime,
            origin_record_id, is_primary_origin, created_at)
         VALUES ($1, $2, $3, 'sheet', $4, 1, $5)`,
        [workbookOriginLinkId, workbookArtifactId, orgA, workbookId, now]
      );

      const [tablePlatformRouter, artifactsRouter] = await Promise.all([
        import('../table-platform.routes.js'),
        import('../artifacts.routes.js'),
      ]);
      app = express();
      app.use(express.json());
      app.use('/api/table-platform', tablePlatformRouter.default);
      app.use('/api/artifacts', artifactsRouter.default);
      app.use((error: any, _req: any, res: any, _next: any) =>
        res.status(500).json({ error: String(error?.message || error) })
      );
    }, 60_000);

    afterAll(async () => {
      if (!pool) return;
      await pool.query('DELETE FROM v8_artifact_origin_links WHERE link_id IN ($1, $2)', [
        tableOriginLinkId,
        workbookOriginLinkId,
      ]);
      await pool.query('DELETE FROM v8_output_artifacts WHERE artifact_id IN ($1, $2)', [
        tableArtifactId,
        workbookArtifactId,
      ]);
      await pool.query('DELETE FROM generated_workbooks WHERE id = $1', [workbookId]);
      await pool.query('DELETE FROM tp_tables WHERE id = $1', [tableId]);
      await pool.query('DELETE FROM tp_bases WHERE id = $1', [baseId]);
      await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [
        orgA,
        orgB,
      ]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [ownerA, adminA, adminB]);
      await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgA, orgB]);
      await pool.end();
    });

    it('allows an ADMIN in the table organization even when another user created the base', async () => {
      const response = await request(app)
        .get(`/api/table-platform/tables/${tableId}`)
        .set(bearer(adminA, orgA));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({ id: tableId, base_id: baseId, created_by: ownerA })
      );
    });

    it('fails closed for an ADMIN from a different organization', async () => {
      const response = await request(app)
        .get(`/api/table-platform/tables/${tableId}`)
        .set(bearer(adminB, orgB));

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(tableAccessDeniedMessage);
    });

    it('fails closed when the base creator presents a token for another organization', async () => {
      const response = await request(app)
        .get(`/api/table-platform/tables/${tableId}`)
        .set(bearer(ownerA, orgB));

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(tableAccessDeniedMessage);
    });

    it('resolves the same-organization sheet artifact to its real table id', async () => {
      const response = await request(app)
        .get(`/api/artifacts/${tableArtifactId}/action-target`)
        .set(bearer(adminA, orgA));

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          artifactId: tableArtifactId,
          originRuntime: 'sheet',
          originRecordId: tableId,
        })
      );
    });

    it('does not reveal a sheet artifact action target across organizations', async () => {
      const response = await request(app)
        .get(`/api/artifacts/${tableArtifactId}/action-target`)
        .set(bearer(adminB, orgB));

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(artifactNotFoundMessage);
    });

    it('reads back a real generated_workbooks row with the exact current-writer marker', async () => {
      const result = await pool.query(
        `SELECT a.origin_summary_json, l.origin_runtime, l.origin_record_id,
                w.id AS workbook_id, w.sheet_count
           FROM v8_output_artifacts a
           JOIN v8_artifact_origin_links l
             ON l.artifact_id = a.artifact_id
            AND l.organization_id = a.organization_id
           JOIN generated_workbooks w
             ON w.id = l.origin_record_id
            AND w.organization_id = a.organization_id
          WHERE a.artifact_id = $1 AND a.organization_id = $2`,
        [workbookArtifactId, orgA]
      );

      expect(result.rows).toEqual([
        expect.objectContaining({
          origin_summary_json: JSON.stringify({ sheetCount: 2, source: 'workbook-generator' }),
          origin_runtime: 'sheet',
          origin_record_id: workbookId,
          workbook_id: workbookId,
          sheet_count: 2,
        }),
      ]);
    });
  }
);
