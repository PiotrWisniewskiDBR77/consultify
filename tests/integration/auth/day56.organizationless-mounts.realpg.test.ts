/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';

type Method = 'get' | 'post' | 'patch';
type MountCase = {
  mount: string;
  method: Method;
  path: string;
  organizationOptional: boolean;
  tipCode?: string;
};

const cases: MountCase[] = [
  {
    mount: 'Gateway conversations',
    method: 'get',
    path: '/api/conversations',
    organizationOptional: true,
  },
  { mount: 'Gateway signals', method: 'get', path: '/api/signals', organizationOptional: false },
  {
    mount: 'Gateway chat-projects',
    method: 'get',
    path: '/api/chat-projects',
    organizationOptional: true,
  },
  {
    mount: 'interviewCandidateHandoff router.use',
    method: 'get',
    path: '/api/interview/candidate-handoff/submission/missing/preview',
    organizationOptional: false,
  },
  {
    mount: 'initiativeCandidates router.use',
    method: 'post',
    path: '/api/initiatives/flow-transform/certify',
    organizationOptional: false,
  },
  {
    mount: 'ideaBusinessCase router.use',
    method: 'get',
    path: '/api/idea-business-case/missing',
    organizationOptional: false,
  },
  {
    mount: 'interview router.use',
    method: 'get',
    path: '/api/interview/sessions',
    organizationOptional: false,
  },
  {
    mount: 'pmo initiatives router.use',
    method: 'get',
    path: '/api/pmo/initiatives',
    organizationOptional: false,
  },
  {
    mount: 'my-work router.use',
    method: 'get',
    path: '/api/my-work/inbox',
    organizationOptional: false,
  },
  {
    mount: 'organization-context router.use',
    method: 'get',
    path: '/api/organization-context',
    organizationOptional: false,
  },
  {
    mount: 'v8 chat router.use',
    method: 'get',
    path: '/api/v8/chat/snapshots',
    organizationOptional: false,
    tipCode: 'V8_MISSING_ORG_CONTEXT',
  },
  {
    mount: 'workbook template build',
    method: 'post',
    path: '/api/workbook/templates/missing/build',
    organizationOptional: false,
    tipCode: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
  },
  {
    mount: 'workbook schema-command',
    method: 'patch',
    path: '/api/workbook/missing/schema-command',
    organizationOptional: false,
    tipCode: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
  },
  {
    mount: 'audit processing summary',
    method: 'get',
    path: '/api/audit-logs/organization-context/processing-jobs/summary',
    organizationOptional: false,
  },
  {
    mount: 'audit processing jobs',
    method: 'get',
    path: '/api/audit-logs/organization-context/processing-jobs',
    organizationOptional: false,
  },
  {
    mount: 'audit recover stale locks',
    method: 'post',
    path: '/api/audit-logs/organization-context/processing-jobs/recover-stale-locks',
    organizationOptional: false,
  },
  {
    mount: 'audit requeue job',
    method: 'post',
    path: '/api/audit-logs/organization-context/processing-jobs/missing/requeue',
    organizationOptional: false,
  },
  {
    mount: 'audit run worker',
    method: 'post',
    path: '/api/audit-logs/organization-context/processing-jobs/run-worker',
    organizationOptional: false,
  },
];

const databaseUrl = process.env.DATABASE_URL || '';
const runId = randomUUID();
const userId = `day56-no-org-mounts-${runId}`;
let client: Client;
let app: Express;

function signedToken(): string {
  return jwt.sign({ id: userId, role: 'ADMIN' }, config.JWT_SECRET, {
    expiresIn: '30m',
    ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
    ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
  });
}

describe('Day 56 all 18 organization-membership mounts', { retry: 0 }, () => {
  beforeAll(async () => {
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,NULL,$2,'!','NoOrg','Mounts','ADMIN','active')`,
      [userId, `${userId}@test.local`]
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM revoked_tokens WHERE user_id=$1`, [userId]);
    await client.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await client.end();
  });

  it('measures every mount and pins both route classes on the current tip', async () => {
    const rows = [];
    for (const entry of cases) {
      const response = await request(app)
        [entry.method](entry.path)
        .set('Authorization', `Bearer ${signedToken()}`)
        .send({});
      rows.push({
        mount: entry.mount,
        path: entry.path,
        status: response.status,
        code: response.body?.code ?? null,
      });
      if (process.env.DAY56_MOUNT_MATRIX_MODE !== 'marker') {
        if (entry.organizationOptional) {
          expect(response.status, entry.mount).toBe(200);
        } else {
          expect({ status: response.status, code: response.body?.code }, entry.mount).toEqual({
            status: 403,
            code: entry.tipCode ?? 'ORG_CONTEXT_REQUIRED',
          });
        }
      }
    }
    console.log(`DAY56_MOUNT_MATRIX=${JSON.stringify(rows)}`);
    expect(rows).toHaveLength(18);
  });
});
