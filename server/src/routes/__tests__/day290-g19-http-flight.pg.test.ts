/** @vitest-environment node */

import type { Server } from 'node:http';

import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const OWNER_ORG = '29000000-0000-4000-8000-000000000001';
const FOREIGN_ORG = '29000000-0000-4000-8000-000000000002';
const OWNER_USER = '29000000-0000-4000-8000-000000000011';
const FOREIGN_USER = '29000000-0000-4000-8000-000000000012';

const surfaces = [
  ['adminP32.routes.ts', 'GET', '/api/admin/people'],
  ['ai.routes.ts', 'GET', '/api/ai/context'],
  ['auth.routes.ts', 'GET', '/api/auth/sessions'],
  ['help.routes.ts', 'GET', '/api/help/playbooks'],
  ['meeting.routes.ts', 'GET', '/api/meeting'],
  ['mfa.routes.ts', 'GET', '/api/mfa/status'],
  ['pmo/decisions.routes.ts', 'GET', '/api/decisions'],
  ['pmo/initiativesExecutionRuntime.routes.ts', 'GET', '/api/initiatives/runtime-v1/execution-cases'],
  ['security.routes.ts', 'GET', '/api/security/settings'],
  ['v8/chat.routes.ts', 'GET', '/api/v8/chat/snapshots?conversationId=day290-missing'],
  ['v8/index.ts', 'GET', '/api/v8/health'],
  ['v8/teresa.routes.ts', 'GET', '/api/v8/teresa/proposal/day290-missing'],
] as const;

describe('Day 290 G19 — HTTP flight over 12 changed route files', NO_RETRY, () => {
  let server: Server;
  let ownerAuthorization: string;
  let foreignAuthorization: string;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const sign = (id: string, organizationId: string) =>
      `Bearer ${jwt.sign(
        { id, userId: id, organizationId, organization_id: organizationId, role: 'OWNER' },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      )}`;
    ownerAuthorization = sign(OWNER_USER, OWNER_ORG);
    foreignAuthorization = sign(FOREIGN_USER, FOREIGN_ORG);
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(5258, '127.0.0.1', () => resolve(listener));
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('uses PostgreSQL and the exclusively assigned HTTP port', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect((server.address() as { port: number }).port).toBe(5258);
  });

  it('records OWNER and foreign-organization responses without leaking owner identifiers', async () => {
    const rows: Array<Record<string, string | number | boolean>> = [];
    for (const [file, method, path] of surfaces) {
      const call = async (authorization: string) => {
        const response = await fetch(`http://127.0.0.1:5258${path}`, {
          method,
          headers: { Authorization: authorization },
        });
        return { status: response.status, body: await response.text() };
      };
      const owner = await call(ownerAuthorization);
      const foreign = await call(foreignAuthorization);
      const foreignLeaksOwner = [OWNER_ORG, OWNER_USER, 'day290-owner@test.invalid'].some((value) =>
        foreign.body.includes(value)
      );
      rows.push({
        file,
        method,
        path,
        ownerStatus: owner.status,
        foreignStatus: foreign.status,
        foreignLeaksOwner,
      });
      expect(foreignLeaksOwner, `${file} ${path}`).toBe(false);
    }
    console.log(`DAY290_HTTP_FLIGHT=${JSON.stringify(rows)}`);
  }, 60_000);
});
