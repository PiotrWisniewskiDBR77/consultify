#!/usr/bin/env tsx
/**
 * Wave 3 local-only owner-review fixture for canonical DRD Method Core.
 *
 * Uses the mounted production HTTP routes (including governed DRD pack
 * bootstrap and idempotency) rather than inserting method truth directly.
 * It creates no users and therefore does not alter the Organization owner
 * review surface. Reruns preserve the same session and event identities.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';

const CONFIRM_ENV = 'SEED_WAVE3_ASSESSMENT_OWNER_REVIEW';
const databaseUrl = process.env.DATABASE_URL ?? '';
const organizationId =
  process.env.WAVE3_ORGANIZATION_ID ?? 'fd1827ef-7e39-4c64-bf78-26a2c514adf1';
const ownerId = process.env.WAVE3_OWNER_ID ?? '0c13d1af-af67-4683-ad01-a3ea6fda2340';

if (process.env[CONFIRM_ENV] !== 'YES') {
  throw new Error(`${CONFIRM_ENV}=YES is required`);
}
if (!/^postgres(?:ql)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) {
  throw new Error('Wave 3 Assessment fixture requires loopback PostgreSQL');
}

process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.NODE_ENV = 'test';
process.env.RUN_DB_TESTS = '1';
process.env.CI = 'true';
process.env.POSTGRES_SKIP_INIT_IN_TEST = '1';

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const identity = await client.query<{ organization_id: string; role: string; email: string }>(
    'SELECT organization_id, role, email FROM users WHERE id=$1',
    [ownerId]
  );
  if (identity.rows[0]?.organization_id !== organizationId) {
    throw new Error('Wave 3 owner does not belong to the requested organization');
  }

  const [{ default: config }, { default: methodCoreRoutes }, registry] = await Promise.all([
    import('../src/config/Config.js'),
    import('../src/routes/method-core.routes.js'),
    import('../src/method-core/MethodPackRegistry.js'),
  ]);
  const token = jwt.sign(
    {
      id: ownerId,
      email: identity.rows[0].email,
      organizationId,
      role: identity.rows[0].role,
    },
    config.JWT_SECRET,
    {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    }
  );

  const app = express();
  app.use(express.json());
  app.use('/api/method', methodCoreRoutes);
  const auth = { Authorization: `Bearer ${token}` };

  const create = await request(app)
    .post('/api/method/sessions')
    .set(auth)
    .set('Idempotency-Key', 'wave3-assessment-owner-guided-v1:create')
    .send({
      module: 'assessment',
      methodPackId: registry.DRD_METHOD_PACK_ID,
      methodPackVersion: registry.DRD_METHOD_PACK_VERSION,
      mode: 'guided_manual',
      projectId: null,
    });
  if (![200, 201].includes(create.status)) {
    throw new Error(`DRD session create failed (${create.status}): ${JSON.stringify(create.body)}`);
  }
  const sessionId = String(create.body.session?.id ?? '');
  if (!sessionId) throw new Error('DRD session create returned no session id');

  const getSession = async () => {
    const response = await request(app).get(`/api/method/sessions/${sessionId}`).set(auth);
    if (response.status !== 200) {
      throw new Error(`DRD session readback failed (${response.status})`);
    }
    return response.body.session as { state: string; version: number };
  };

  let session = await getSession();
  for (const target of ['prepared', 'active']) {
    if (session.state === target || (target === 'prepared' && session.state === 'active')) continue;
    const transition = await request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set(auth)
      .set('Idempotency-Key', `wave3-assessment-owner-guided-v1:transition:${target}`)
      .send({ to: target });
    if (transition.status !== 200) {
      throw new Error(`DRD transition to ${target} failed (${transition.status}): ${JSON.stringify(transition.body)}`);
    }
    session = transition.body.session;
  }

  const events = [
    {
      key: 'customer-data-drafted',
      type: 'ANSWER_DRAFTED',
      unitId: '1A',
      level: 2,
      payload: {
        questionId: '1A-L2-Q1',
        answerState: 'draft',
        answerText: 'Dane klienta mają właścicieli w poszczególnych projektach, ale nie ma jednego standardu kompletności przed startem wdrożenia.',
      },
    },
    {
      key: 'customer-data-evidence',
      type: 'EVIDENCE_ATTACHED',
      unitId: '1A',
      payload: {
        evidenceId: 'wave3-asm-evidence-customer-handoff-v1',
        evidenceType: 'interview',
        strength: 'E2',
        summary: 'W ostatnim kwartale start jednego wdrożenia przesunął się o dziewięć dni z powodu brakującego właściciela danych.',
      },
    },
    {
      key: 'customer-data-confirmed',
      type: 'ANSWER_CONFIRMED',
      unitId: '1A',
      level: 2,
      payload: { questionId: '1A-L2-Q1', answerState: 'confirmed' },
    },
    {
      key: 'governance-drafted',
      type: 'ANSWER_DRAFTED',
      unitId: '1B',
      level: 1,
      payload: {
        questionId: '1B-L1-Q1',
        answerState: 'draft',
        answerText: 'Decyzja o gotowości klienta jest dziś rozproszona między sprzedażą, delivery i kierownikiem projektu.',
      },
    },
    {
      key: 'governance-evidence',
      type: 'EVIDENCE_ATTACHED',
      unitId: '1B',
      payload: {
        evidenceId: 'wave3-asm-evidence-readiness-gate-v1',
        evidenceType: 'document',
        strength: 'E1',
        summary: 'Brak wspólnej checklisty i jawnej decyzji gotowe albo zwrot do uzupełnienia.',
      },
    },
    {
      key: 'governance-confirmed',
      type: 'ANSWER_CONFIRMED',
      unitId: '1B',
      level: 1,
      payload: { questionId: '1B-L1-Q1', answerState: 'confirmed' },
    },
  ] as const;

  for (const event of events) {
    const response = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set(auth)
      .set('Idempotency-Key', `wave3-assessment-owner-guided-v1:event:${event.key}`)
      .send(event);
    if (![200, 201].includes(response.status)) {
      throw new Error(`DRD event ${event.key} failed (${response.status}): ${JSON.stringify(response.body)}`);
    }
  }

  const [sessionReadback, eventReadback, sqlReadback] = await Promise.all([
    getSession(),
    request(app).get(`/api/method/sessions/${sessionId}/events`).set(auth),
    client.query(
      `SELECT s.id, s.state, s.version, s.method_pack_id, s.method_pack_version,
              count(e.id)::int AS events
         FROM method_sessions s
         LEFT JOIN method_events e ON e.session_id=s.id
        WHERE s.id=$1
        GROUP BY s.id`,
      [sessionId]
    ),
  ]);
  if (eventReadback.status !== 200) throw new Error('DRD event readback failed');

  console.log(JSON.stringify({
    fixture: 'wave3-assessment-owner-guided-v1',
    organizationId,
    ownerId,
    route: `/assessment/drd/${sessionId}`,
    session: sessionReadback,
    httpEvents: eventReadback.body.events?.length ?? 0,
    sqlReadback: sqlReadback.rows[0],
    note: 'Guided active state only; distinct-approver freeze fixture waits until Organization owner review releases its user surface.',
  }, null, 2));
} finally {
  await client.end();
}
