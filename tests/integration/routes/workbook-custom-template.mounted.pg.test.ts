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
    await pool.query(`DELETE FROM generated_workbooks WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
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
    const call = (id: string, user: string, org: string, params: object = {}) =>
      request(app)
        .post(`/api/workbook/templates/${id}/build`)
        .set('Authorization', `Bearer ${token(user, org)}`)
        .send({ params });
    expect((await call(templateId, ownerB, orgB)).status).toBe(404);
    expect((await call(templateId, revoked, orgA)).status).toBe(403);
    expect((await call(privateId, memberA, orgA)).status).toBe(404);
    expect((await call(draftId, ownerA, orgA)).status).toBe(404);
    expect((await call(draftId, memberA, orgA, { title: 'Transferred' })).status).toBe(200);
    expect((await call(deprecatedId, ownerA, orgA)).status).toBe(404);
    expect((await call(randomUUID(), ownerA, orgA)).status).toBe(404);
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
