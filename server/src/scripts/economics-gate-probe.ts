/**
 * Probe: czy `/api/economics` jest realnie zamknięte dla użytkownika bez prawa
 * do modułu (MODULE_ECONOMICS = 'closed' w src/utils/betaAccess.ts).
 *
 * Para dowodów wymagana przez zlecenie:
 *   NEG  — użytkownik o roli USER nie może zapisać (403 BETA_LOCKED, zero wierszy)
 *   POS  — użytkownik o roli OWNER może zapisać (201 + odczyt na zimno)
 *
 * Uruchamiane wyłącznie przez `npx tsx` (vitest podmienia global.fetch).
 */
import assert from 'node:assert/strict';

import express, { type Express } from 'express';
import pg from 'pg';

const REQUIRED_ENV: Record<string, string> = {
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
  DB_TYPE: 'postgres',
  NODE_ENV: 'test',
  ENABLE_TEST_AUTH_BYPASS: 'false',
  CI: 'true',
};
for (const [name, expected] of Object.entries(REQUIRED_ENV)) {
  assert.equal(process.env[name], expected, `${name} must equal ${expected}`);
}
const DATABASE_URL = process.env.DATABASE_URL || '';
assert.equal(
  DATABASE_URL,
  'postgresql://cx:cx@127.0.0.1:6278/cxecon',
  'DATABASE_URL must target the disposable econ-gate database'
);
assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be set');

const port = Number(process.env.PORT || '5282');
assert.ok(port === 5282 || port === 5283, 'Harness may only use ports 5282 or 5283');

const PASSWORD = 'EconGate-Local-Only-Password-1';
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
    body: { email, password: PASSWORD, firstName: 'Econ', lastName: 'Gate', companyName, isDemo: true },
  });
  assert.equal(result.status, 200, `registration failed: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function login(email: string): Promise<{ token: string; userId: string; role: string; organizationId: string }> {
  const result = await requestJson('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.body)}`);
  return {
    token: result.body.token as string,
    userId: result.body.user?.id as string,
    role: String(result.body.user?.role || ''),
    organizationId: String(result.body.user?.organizationId || ''),
  };
}

/** Odczyt NA ZIMNO: osobne połączenie pg, poza pulą aplikacji. */
async function coldCountAnalyses(orgId: string, name: string): Promise<number> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query(
      'SELECT count(*)::int AS n FROM digitization_analyses WHERE organization_id = $1 AND name = $2',
      [orgId, name]
    );
    return r.rows[0].n as number;
  } finally {
    await client.end();
  }
}

async function demoteToUser(email: string): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const u = await client.query('SELECT id, organization_id FROM users WHERE email = $1', [email]);
    assert.equal(u.rowCount, 1, `user ${email} not found`);
    const userId = u.rows[0].id;
    await client.query("UPDATE users SET role = 'USER' WHERE id = $1", [userId]);
    const m = await client.query(
      "UPDATE organization_members SET role = 'USER' WHERE user_id = $1 RETURNING role",
      [userId]
    );
    assert.ok((m.rowCount ?? 0) >= 1, 'no organization_members row to demote');
  } finally {
    await client.end();
  }
}

async function cleanup(orgIds: string[]): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM digitization_analyses WHERE organization_id = ANY($1::text[])', [orgIds]);
  } finally {
    await client.end();
  }
}

async function run(): Promise<void> {
  const nonce = Date.now();
  const emailOwner = `econgate+owner-${nonce}@local.test`;
  const emailUser = `econgate+user-${nonce}@local.test`;

  await register(emailOwner, `EconGate Owner Org ${nonce}`);
  await register(emailUser, `EconGate User Org ${nonce}`);
  await demoteToUser(emailUser);

  const owner = await login(emailOwner);
  const user = await login(emailUser);

  const out: Json = {
    roles: { owner: owner.role, user: user.role },
  };

  // --- NEGATYW: rola USER (bez prawa do zamkniętego modułu) ---
  {
    const name = `EconGate NEG ${nonce}`;
    const write = await requestJson('POST', '/api/economics/analyses', {
      token: user.token,
      body: { name },
    });
    const rowsAfter = await coldCountAnalyses(user.organizationId, name);
    out.negative = {
      role: user.role,
      writeStatus: write.status,
      writeBody: write.body,
      coldRowCount: rowsAfter,
      blocked: write.status === 403 && write.body?.code === 'BETA_LOCKED' && rowsAfter === 0,
    };
  }

  // --- POZYTYW: rola OWNER (uprawniony MUSI móc) ---
  {
    const name = `EconGate POS ${nonce}`;
    const write = await requestJson('POST', '/api/economics/analyses', {
      token: owner.token,
      body: { name },
    });
    const rowsAfter = await coldCountAnalyses(owner.organizationId, name);
    // odczyt na zimno przez API: świeży login, świeży JWT
    const fresh = await login(emailOwner);
    const analysisId = write.body?.analysis?.id;
    const read = analysisId
      ? await requestJson('GET', `/api/economics/analyses/${analysisId}`, { token: fresh.token })
      : { status: -1, body: {} };
    out.positive = {
      role: owner.role,
      writeStatus: write.status,
      writeBody: write.body?.analysis ? { id: write.body.analysis.id, name: write.body.analysis.name } : write.body,
      coldRowCount: rowsAfter,
      apiColdRead: { status: read.status, name: read.body?.analysis?.name ?? read.body?.name },
      allowed: write.status === 201 && rowsAfter === 1,
    };
  }

  // --- OBSERWACJA (bez naprawy): siostrzany mount tego samego modułu Finance.
  // `/api/financial-modeling` (Gateway.ts) też stoi za atrapą `betaGate`
  // i jest wołany z `src/components/Economics/**`. Mierzymy, nie naprawiamy.
  {
    const sibling = await requestJson('GET', '/api/financial-modeling/models', { token: user.token });
    out.siblingObservation = {
      mount: '/api/financial-modeling',
      role: user.role,
      status: sibling.status,
      code: sibling.body?.code ?? null,
      stillOpenToNonAdmin: sibling.status !== 403,
    };
  }

  out.verdict = {
    unauthorizedBlocked: out.negative.blocked,
    authorizedAllowed: out.positive.allowed,
    pass: out.negative.blocked && out.positive.allowed,
  };

  console.log(JSON.stringify(out, null, 2));

  if (process.env.ECON_GATE_CLEANUP === '1') {
    await cleanup([user.organizationId, owner.organizationId]);
    console.log(JSON.stringify({ cleanup: 'digitization_analyses rows removed' }));
  }
}

async function main(): Promise<void> {
  const app: Express = express();
  app.use(express.json({ limit: '2mb' }));
  const { ApiGateway } = await import('../Gateway.js');
  ApiGateway.getInstance().initializeRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[econ-gate] unhandled route error', error);
    res.status(500).json({ error: 'econ_gate_harness_error', detail: String(error) });
  });
  const server = app.listen(port, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await run();
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error('[econ-gate] FAILED', error);
    process.exit(1);
  }
);
