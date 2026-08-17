/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../../../server/src/config/Config.js';

const url = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

describe.skipIf(!enabled)('mounted custom workbook template', () => {
  const prefix = `wb-custom-${randomUUID()}`;
  const orgA = randomUUID(),
    orgB = randomUUID();
  const ownerA = randomUUID(),
    ownerB = randomUUID(),
    memberA = randomUUID(),
    revoked = randomUUID();
  const templateId = randomUUID(),
    privateId = randomUUID(),
    draftId = randomUUID(),
    deprecatedId = randomUUID();
  const pool = new Pool({ connectionString: url });
  let app: express.Express;
  const token = (id: string, org: string) =>
    jwt.sign(
      { id, organizationId: org, role: 'OWNER', email: `${id}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  const callTemplate = (id: string, user: string, org: string, params: object = {}) =>
    request(app)
      .post(`/api/workbook/templates/${id}/build`)
      .set('Authorization', `Bearer ${token(user, org)}`)
      .send({ params });
  const schema = {
    title: 'Governed custom workbook',
    metadata: { sourceVersion: 'v1' },
    sheets: [
      {
        name: 'Model',
        columns: [{ key: 'A', header: 'Value', type: 'number' }],
        rows: [{ cells: { A: { value: 42 } } }],
      },
    ],
  };

  beforeAll(async () => {
    for (const [id, name] of [
      [orgA, `${prefix}-A`],
      [orgB, `${prefix}-B`],
    ])
      await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
        id,
        name,
      ]);
    for (const [id, org, status, role] of [
      [ownerA, orgA, 'ACTIVE', 'OWNER'],
      [ownerB, orgB, 'ACTIVE', 'OWNER'],
      [memberA, orgA, 'ACTIVE', 'MEMBER'],
      [revoked, orgA, 'REVOKED', 'MEMBER'],
    ]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'x',$4,'active')`,
        [id, org, `${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`,
        [randomUUID(), org, id, role, status]
      );
    }
    await pool.query(
      `INSERT INTO tp_base_templates(id,name,description,category,schema_snapshot,created_by,organization_id,status,visibility,version)
       VALUES($1,'Org model','v1','workbook',$2::jsonb,$3,$4,'approved','organization','1.0.0'),
             ($5,'Private model','v1','workbook',$2::jsonb,$3,$4,'approved','private','1.0.0')`,
      [templateId, JSON.stringify(schema), ownerA, orgA, privateId]
    );
    await pool.query(
      `INSERT INTO tp_base_templates(id,name,category,schema_snapshot,created_by,owner_user_id,organization_id,status,visibility,version)
       VALUES($1,'Transferred draft','workbook',$2::jsonb,$3,$4,$5,'draft','private','3.0.0'),
             ($6,'Deprecated','workbook',$2::jsonb,$3,$3,$5,'deprecated','organization','4.0.0')`,
      [draftId, JSON.stringify(schema), ownerA, memberA, orgA, deprecatedId]
    );
    const { default: routes } = await import('../../../server/src/routes/workbook.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/workbook', routes);
  }, 60_000);

  afterAll(async () => {
    const cleanup = await pool.connect();
    try {
      await cleanup.query('BEGIN');
      await cleanup.query(
        `DELETE FROM v8_artifact_origin_links l
          USING v8_output_artifacts a
         WHERE l.artifact_id=a.artifact_id
           AND a.organization_id=ANY($1)`,
        [[orgA, orgB]]
      );
      await cleanup.query(`DELETE FROM v8_output_artifacts WHERE organization_id=ANY($1)`, [
        [orgA, orgB],
      ]);
      await cleanup.query(`DELETE FROM generated_workbooks WHERE organization_id=ANY($1)`, [
        [orgA, orgB],
      ]);
      const residue = (
        await cleanup.query(
          `SELECT
             (SELECT count(*)::int FROM generated_workbooks WHERE organization_id=ANY($1)) workbooks,
             (SELECT count(*)::int FROM v8_output_artifacts WHERE organization_id=ANY($1)) artifacts,
             (SELECT count(*)::int FROM v8_artifact_origin_links
              WHERE organization_id=ANY($1)) origins`,
          [[orgA, orgB]]
        )
      ).rows[0];
      expect(residue).toEqual({ workbooks: 0, artifacts: 0, origins: 0 });
      await cleanup.query('COMMIT');
    } catch (error) {
      await cleanup.query('ROLLBACK');
      throw error;
    } finally {
      cleanup.release();
    }
    await pool.query(`DELETE FROM tp_base_templates WHERE id=ANY($1::uuid[])`, [
      [templateId, privateId, draftId, deprecatedId],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [[ownerA, ownerB, memberA, revoked]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('materializes the canonical workbook with exact lifecycle version, snapshot hash and cold readback', async () => {
    const built = await request(app)
      .post(`/api/workbook/templates/${templateId}/build`)
      .set('Authorization', `Bearer ${token(ownerA, orgA)}`)
      .send({ params: { title: 'Approved Run' } });
    expect(built.status, JSON.stringify(built.body)).toBe(200);
    const row = (
      await pool.query(
        `SELECT organization_id,schema_json,version,action_contract_json,source_pack_json FROM generated_workbooks WHERE id=$1`,
        [built.body.id]
      )
    ).rows[0];
    const persisted =
      typeof row.schema_json === 'string' ? JSON.parse(row.schema_json) : row.schema_json;
    const action =
      typeof row.action_contract_json === 'string'
        ? JSON.parse(row.action_contract_json)
        : row.action_contract_json;
    const source =
      typeof row.source_pack_json === 'string'
        ? JSON.parse(row.source_pack_json)
        : row.source_pack_json;
    expect(row.organization_id).toBe(orgA);
    expect(row.version).toBe(0);
    expect(persisted.title).toBe('Approved Run');
    expect(persisted.metadata.sourceVersion).toBe('v1');
    expect(persisted.metadata.customTemplateSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(action).toMatchObject({
      templateId,
      templateVersion: '1.0.0',
      templateSnapshotHash: persisted.metadata.customTemplateSnapshotHash,
    });
    expect(source).toMatchObject({
      kind: 'custom_workbook_template',
      templateId,
      templateVersion: '1.0.0',
      templateSnapshotHash: persisted.metadata.customTemplateSnapshotHash,
    });
    expect(
      (
        await request(app)
          .get(`/api/workbook/${built.body.id}/schema`)
          .set('Authorization', `Bearer ${token(ownerA, orgA)}`)
      ).status
    ).toBe(200);
  });

  it('enforces lifecycle, ownership, membership and tenant walls without false artifacts', async () => {
    const { workbookRuntimeCache } = await import(
      '../../../server/src/services/workbook/workbookRuntimeCache.js'
    );
    const state = async () => {
      const row = (
        await pool.query(
          `SELECT
             (SELECT count(*)::int FROM generated_workbooks WHERE organization_id=ANY($1)) workbooks,
             (SELECT count(*)::int FROM v8_output_artifacts WHERE organization_id=ANY($1)) artifacts,
             (SELECT count(*)::int FROM v8_artifact_origin_links l
               JOIN v8_output_artifacts a ON a.artifact_id=l.artifact_id
              WHERE a.organization_id=ANY($1)) origins`,
          [[orgA, orgB]]
        )
      ).rows[0];
      return { ...row, cache: workbookRuntimeCache.size };
    };
    const beforeDenied = await state();
    expect((await callTemplate(templateId, ownerB, orgB)).status).toBe(404);
    expect((await callTemplate(templateId, revoked, orgA)).status).toBe(403);
    expect((await callTemplate(privateId, memberA, orgA)).status).toBe(404);
    expect((await callTemplate(draftId, ownerA, orgA)).status).toBe(404);
    expect((await callTemplate(deprecatedId, ownerA, orgA)).status).toBe(404);
    expect((await callTemplate(randomUUID(), ownerA, orgA)).status).toBe(404);
    expect(await state()).toEqual(beforeDenied);
    expect((await callTemplate(draftId, memberA, orgA, { title: 'Transferred' })).status).toBe(200);

    const { listCustomWorkbookTemplates, resolveCustomWorkbookTemplate } = await import(
      '../../../server/src/services/workbook/customWorkbookTemplateService.js'
    );
    const fixtureIds = new Set([templateId, privateId, draftId, deprecatedId]);
    const ownerListed = (await listCustomWorkbookTemplates(orgA, ownerA))
      .map((row) => row.id)
      .filter((id) => fixtureIds.has(id))
      .sort();
    expect(ownerListed).toEqual([privateId, templateId].sort());
    for (const id of ownerListed)
      expect(await resolveCustomWorkbookTemplate(id, orgA, ownerA)).not.toBeNull();
    expect(await resolveCustomWorkbookTemplate(draftId, orgA, ownerA)).toBeNull();
    expect(await resolveCustomWorkbookTemplate(deprecatedId, orgA, ownerA)).toBeNull();

    const lateSchema = `wb_late_${randomUUID().replace(/-/g, '')}`;
    const control = await pool.connect();
    await control.query(`SELECT pg_advisory_lock(hashtext('workbook-null-late-upgrade-test'))`);
    let latePool: Pool | null = null;
    try {
      await control.query(`CREATE SCHEMA ${lateSchema}`);
      await control.query(
        `CREATE TABLE ${lateSchema}.tp_base_templates
           (LIKE public.tp_base_templates INCLUDING ALL)`
      );
      await control.query(
        `ALTER TABLE ${lateSchema}.tp_base_templates ALTER COLUMN status DROP NOT NULL`
      );
      const systemId = randomUUID(), orgId = randomUUID(), privateIdLate = randomUUID();
      await control.query(
        `INSERT INTO ${lateSchema}.tp_base_templates
           (id,name,category,schema_snapshot,created_by,organization_id,status,visibility,version)
         VALUES
           ($1,'Legacy system','workbook',$2::jsonb,NULL,NULL,NULL,'organization','legacy-system'),
           ($3,'Legacy org','workbook',$2::jsonb,$4,$5,NULL,'organization','legacy-org'),
           ($6,'Legacy private','workbook',$2::jsonb,$4,$5,NULL,'private','legacy-private')`,
        [systemId, JSON.stringify(schema), orgId, ownerA, orgA, privateIdLate]
      );
      latePool = new Pool({
        connectionString: url,
        options: `-c search_path=${lateSchema},public`,
      });
      const pgSql = (sql: string) => {
        let index = 0;
        return sql.replace(/\?/g, () => `$${++index}`);
      };
      const reader = {
        queryOne: async <T>(sql: string, params: unknown[] = []) =>
          (await latePool!.query<T>(pgSql(sql), params)).rows[0] ?? null,
        queryAll: async <T>(sql: string, params: unknown[] = []) =>
          (await latePool!.query<T>(pgSql(sql), params)).rows,
      };
      const ownerNullIds = (await listCustomWorkbookTemplates(orgA, ownerA, reader))
        .map((row) => row.id)
        .sort();
      expect(ownerNullIds).toEqual([systemId, orgId, privateIdLate].sort());
      for (const id of ownerNullIds)
        expect(await resolveCustomWorkbookTemplate(id, orgA, ownerA, reader)).not.toBeNull();
      const memberNullIds = (await listCustomWorkbookTemplates(orgA, memberA, reader))
        .map((row) => row.id)
        .sort();
      expect(memberNullIds).toEqual([systemId, orgId].sort());
      expect(await resolveCustomWorkbookTemplate(privateIdLate, orgA, memberA, reader)).toBeNull();
    } finally {
      await latePool?.end();
      await control.query(`DROP SCHEMA IF EXISTS ${lateSchema} CASCADE`);
      await control.query(`SELECT pg_advisory_unlock(hashtext('workbook-null-late-upgrade-test'))`);
      control.release();
    }
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM generated_workbooks WHERE organization_id=$1`,
          [orgB]
        )
      ).rows[0].n
    ).toBe(0);
  });
});
