import assert from 'node:assert/strict';

import express, { type Express } from 'express';

const REQUIRED_ENV: Record<string, string> = {
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
  DB_TYPE: 'postgres',
  NODE_ENV: 'test',
  ENABLE_V8_GLOBAL: 'true',
  ENABLE_TEST_AUTH_BYPASS: 'false',
  RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE: 'enforce',
};

for (const [name, expected] of Object.entries(REQUIRED_ENV)) {
  assert.equal(process.env[name], expected, `${name} must equal ${expected}`);
}
assert.equal(
  process.env.DATABASE_URL,
  'postgresql://postgres:cx@127.0.0.1:6264/cx279',
  'DATABASE_URL must target the day 279 disposable database'
);
assert.equal(process.env.JWT_SECRET, 'cx279-test-secret-do-not-reuse');

const port = Number(process.env.PORT || '5244');
assert.ok(port === 5244 || port === 5245, 'Harness may only use ports 5244 or 5245');

type Json = Record<string, any>;

async function requestJson(
  method: string,
  path: string,
  options: { token?: string; body?: Json } = {}
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Connection: 'close',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body: Json;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function register(email: string, companyName: string): Promise<Json> {
  const result = await requestJson('POST', '/api/auth/register', {
    body: {
      email,
      password: 'Day279-Local-Only-Password-1',
      firstName: 'Day',
      lastName: 'TwoSevenNine',
      companyName,
      isDemo: true,
    },
  });
  assert.equal(result.status, 200, `registration failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body.user?.companyName, companyName);
  assert.ok(result.body.user?.organizationId);
  return result.body;
}

async function login(email: string): Promise<string> {
  const result = await requestJson('POST', '/api/auth/login', {
    body: { email, password: 'Day279-Local-Only-Password-1' },
  });
  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.token, 'login did not issue a fresh access token');
  return result.body.token;
}

async function runR1R2(): Promise<void> {
  const nonce = Date.now();
  const emailA = `day279+a-${nonce}@local.test`;
  const emailB = `day279+b-${nonce}@local.test`;
  const companyA = `Day279 Organization A ${nonce}`;
  const companyB = `Day279 Organization B ${nonce}`;

  const registeredA = await register(emailA, companyA);
  const registeredB = await register(emailB, companyB);
  const organizationA = registeredA.user.organizationId as string;
  const organizationB = registeredB.user.organizationId as string;
  assert.notEqual(organizationA, organizationB);

  // Cold readback: registration token and connection are discarded. Each login
  // issues a new JWT and every request uses Connection: close.
  const coldTokenA = await login(emailA);
  const positive = await requestJson('GET', `/api/organizations/${organizationA}`, {
    token: coldTokenA,
  });
  assert.equal(positive.status, 200, `positive readback failed: ${JSON.stringify(positive.body)}`);
  const returnedOrganization = positive.body.organization || positive.body;
  assert.equal(returnedOrganization.id, organizationA);
  assert.equal(returnedOrganization.name, companyA);

  const coldTokenB = await login(emailB);
  const negative = await requestJson('GET', `/api/organizations/${organizationA}`, {
    token: coldTokenB,
  });
  assert.ok(
    [403, 404].includes(negative.status),
    `tenant B read organization A with status ${negative.status}: ${JSON.stringify(negative.body)}`
  );

  console.log(
    JSON.stringify(
      {
        phase: 'R1-R2',
        effectiveEnvironment: {
          DB_TYPE: process.env.DB_TYPE,
          RUN_DB_TESTS: process.env.RUN_DB_TESTS,
          MOCK_DB: process.env.MOCK_DB,
          ENABLE_TEST_AUTH_BYPASS: process.env.ENABLE_TEST_AUTH_BYPASS,
        },
        registration: {
          organizationA,
          organizationB,
          companyA,
          companyB,
        },
        coldReadback: {
          status: positive.status,
          id: returnedOrganization.id,
          name: returnedOrganization.name,
        },
        tenantIsolation: {
          status: negative.status,
          body: negative.body,
        },
      },
      null,
      2
    )
  );
}

async function runSingleRegistration(): Promise<void> {
  const email = process.env.DAY279_REGISTER_EMAIL;
  const companyName = process.env.DAY279_REGISTER_COMPANY;
  assert.ok(email && companyName, 'single registration requires email and company name');
  await register(email, companyName);
}

async function runExistingR1R2(): Promise<void> {
  const emailA = process.env.DAY279_EMAIL_A;
  const emailB = process.env.DAY279_EMAIL_B;
  const organizationA = process.env.DAY279_ORG_A;
  const companyA = process.env.DAY279_COMPANY_A;
  assert.ok(emailA && emailB && organizationA && companyA, 'existing proof inputs are required');

  const coldTokenA = await login(emailA);
  const positive = await requestJson('GET', `/api/organizations/${organizationA}`, {
    token: coldTokenA,
  });
  assert.equal(positive.status, 200, `positive readback failed: ${JSON.stringify(positive.body)}`);
  const returnedOrganization = positive.body.organization || positive.body;
  assert.equal(returnedOrganization.id, organizationA);
  assert.equal(returnedOrganization.name, companyA);

  const coldTokenB = await login(emailB);
  const negative = await requestJson('GET', `/api/organizations/${organizationA}`, {
    token: coldTokenB,
  });
  assert.ok(
    [403, 404].includes(negative.status),
    `tenant B read organization A with status ${negative.status}: ${JSON.stringify(negative.body)}`
  );

  console.log(JSON.stringify({
    phase: 'R1-R2-existing',
    effectiveEnvironment: Object.fromEntries(Object.keys(REQUIRED_ENV).map((key) => [key, process.env[key]])),
    coldReadback: { status: positive.status, id: returnedOrganization.id, name: returnedOrganization.name },
    tenantIsolation: { status: negative.status, body: negative.body },
  }, null, 2));
}

async function main(): Promise<void> {
  const app: Express = express();
  app.use(express.json({ limit: '2mb' }));

  const { ApiGateway } = await import('../Gateway.js');
  ApiGateway.getInstance().initializeRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[day279] unhandled route error', error);
    res.status(500).json({ error: 'day279_harness_error', detail: String(error) });
  });

  const server = app.listen(port, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    if (process.env.DAY279_MODE === 'register-one') await runSingleRegistration();
    else if (process.env.DAY279_MODE === 'existing-r1-r2') await runExistingR1R2();
    else await runR1R2();
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error('[day279] FAILED', error);
    process.exit(1);
  }
);
