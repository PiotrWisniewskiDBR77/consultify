/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
describe('IE00 secondary organization membership', { sequential: true, retry: 0 }, () => {
  let pool: Pool;
  let app: express.Express;
  let token: string;
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const id of ['org-ie00-member-home', 'org-ie00-member-target'])
      await pool.query('INSERT INTO organizations(id,name) VALUES($1,$1) ON CONFLICT DO NOTHING', [
        id,
      ]);
    for (const id of ['ie00-secondary-member', 'ie00-nonmember'])
      await pool.query(
        "INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,'org-ie00-member-home',$2,'unused','ADMIN','active') ON CONFLICT DO NOTHING",
        [id, id + '@ie00.invalid']
      );
    await pool.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES('ie00-secondary-membership','org-ie00-member-target','ie00-secondary-member','ADMIN','ACTIVE') ON CONFLICT DO NOTHING"
    );
    await pool.query(
      "INSERT INTO projects(id,organization_id,name) VALUES('project-ie00-members','org-ie00-member-target','Secondary org proof') ON CONFLICT DO NOTHING"
    );
    for (const id of ['ie00-secondary-member', 'ie00-nonmember'])
      await pool.query(
        "INSERT INTO project_members(id,project_id,user_id,project_role) VALUES($1,'project-ie00-members',$2,'PROJECT_LEADER') ON CONFLICT DO NOTHING",
        ['project-member-' + id, id]
      );
    await pool.query(
      "INSERT INTO ie_governance_policies(organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json) VALUES('org-ie00-member-target','PROJECT','project-ie00-members','ie00-member-policy',1,'STANDARD',2,'{}') ON CONFLICT DO NOTHING"
    );
    for (const id of ['ie00-secondary-member', 'ie00-nonmember'])
      await pool.query(
        "INSERT INTO ie_governance_role_bindings(organization_id,policy_id,policy_version,role_key,principal_id,project_id) VALUES('org-ie00-member-target','ie00-member-policy',1,'GATE_AUTHORITY',$1,'project-ie00-members') ON CONFLICT DO NOTHING",
        [id]
      );
    await pool.query(
      "INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES('org-ie00-member-target','initiative','initiative-ie00-members',1,$1::jsonb) ON CONFLICT DO NOTHING",
      [
        JSON.stringify({
          initiativeId: 'initiative-ie00-members',
          title: 'Membership proof',
          projectId: 'project-ie00-members',
          initiativeOwnerId: 'ie00-secondary-member',
          lifecycleState: 'REGISTERED_DRAFT',
        }),
      ]
    );
    const { default: config } = await import('../../../config/Config.js');
    token = jwt.sign(
      { id: 'ie00-secondary-member', organizationId: 'org-ie00-member-target', role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const { ApiGateway } = await import('../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    process.env.ENABLE_INITIATIVE_APPROVAL_V2 = 'true';
  }, 180000);
  afterAll(async () => {
    await pool?.end();
    delete process.env.ENABLE_INITIATIVE_APPROVAL_V2;
  });
  it('real JWT secondary-org active member is selectable while a same-home-org nonmember stays excluded', async () => {
    const r = await request(app)
      .get('/api/initiatives/runtime-v1/initiatives/initiative-ie00-members/definition-approval')
      .set({ Authorization: `Bearer ${token}`, 'x-organization-id': 'org-ie00-member-target' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.authorities.map((a: any) => a.id)).toEqual(['ie00-secondary-member']);
    expect(r.body.participants.map((a: any) => a.id)).toEqual(['ie00-secondary-member']);
  });
});
