/**
 * Sonda bramek modułów ZAMKNIĘTYCH w SSOT
 * (`server/src/sharedRuntime/utils/betaMenuStatus.ts`).
 *
 * Historia: powstała 2026-09-02 dla `/api/economics` (MODULE_ECONOMICS).
 * 2026-09-02 rozbudowana o CAŁĄ rodzinę mountów tego samego problemu:
 *
 *   1. /api/economics                MODULE_ECONOMICS       (naprawione wcześniej — regresja)
 *   2. /api/financial-modeling       MODULE_ECONOMICS       (ten sam moduł, atrapa `betaGate`)
 *   3. /api/conclusions              MODULE_CONCLUSIONS     (ZERO bramki)
 *   4. /api/v8/case-workspace/cases  MODULE_CASE_WORKSPACE  (ZERO bramki modułu; tylko v8FeatureGate)
 *
 * Para dowodów wymagana dla KAŻDEJ pozycji (samego negatywu NIE wystarczy —
 * zmierzone: bramka bez `verifyToken` przed nią daje zielony negatyw i 403
 * także dla właściciela, czyli wygaszenie modułu dla wszystkich):
 *   NEG — rola USER nie może zapisać (403 BETA_LOCKED, zero wierszy na zimno)
 *   POS — rola OWNER może zapisać (2xx + wiersz potwierdzony odczytem na zimno)
 *
 * Odczyt „na zimno" = osobny klient `pg` poza pulą aplikacji
 * (`Database.ts:686` zwraca `changes:1` dla każdego UPDATE — kod nie jest dowodem).
 *
 * Uruchamiane WYŁĄCZNIE przez `npx tsx` (vitest podmienia `global.fetch`
 * w `tests/setup.ts:858-896` i dałby fałszywy sukces).
 *
 * Tryby:
 *   (domyślnie)         pełny przebieg NEG+POS na wszystkich pozycjach
 *   GATE_PROBE_ONLY=id  tylko wskazana pozycja (economics|financial-modeling|conclusions|case-workspace)
 *   GATE_PROBE_CLEANUP=1  usuwa wiersze i organizacje próbne po pomiarze
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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
assert.match(
  DATABASE_URL,
  /^postgresql:\/\/cx:cx@127\.0\.0\.1:(6278|6288)\/(cxecon|cxbramki)$/,
  'DATABASE_URL must target a disposable local gate database'
);
assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be set');

const port = Number(process.env.PORT || '5292');
assert.ok(
  port === 5282 || port === 5283 || port === 5292 || port === 5293,
  'Harness may only use ports 5282/5283/5292/5293'
);

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

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function register(email: string, companyName: string): Promise<Json> {
  const result = await requestJson('POST', '/api/auth/register', {
    body: {
      email,
      password: PASSWORD,
      firstName: 'Gate',
      lastName: 'Probe',
      companyName,
      isDemo: true,
    },
  });
  assert.equal(result.status, 200, `registration failed: ${JSON.stringify(result.body)}`);
  return result.body;
}

interface Identity {
  email: string;
  token: string;
  userId: string;
  role: string;
  organizationId: string;
}

async function login(email: string): Promise<Identity> {
  const result = await requestJson('POST', '/api/auth/login', {
    body: { email, password: PASSWORD },
  });
  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.body)}`);
  return {
    email,
    token: result.body.token as string,
    userId: result.body.user?.id as string,
    role: String(result.body.user?.role || ''),
    organizationId: String(result.body.user?.organizationId || ''),
  };
}

async function demoteToUser(email: string): Promise<void> {
  await withClient(async (client) => {
    const u = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.equal(u.rowCount, 1, `user ${email} not found`);
    const userId = u.rows[0].id;
    await client.query("UPDATE users SET role = 'USER' WHERE id = $1", [userId]);
    const m = await client.query(
      "UPDATE organization_members SET role = 'USER' WHERE user_id = $1 RETURNING role",
      [userId]
    );
    assert.ok((m.rowCount ?? 0) >= 1, 'no organization_members row to demote');
  });
}

/** Projekt (wymagany przez POST /cases) tworzony na zimno, poza pulą aplikacji. */
async function createProjectCold(organizationId: string, ownerId: string): Promise<string> {
  const id = `proj-gate-${crypto.randomUUID()}`;
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, lead_id)
       VALUES ($1, $2, $3, 'active', $4, $4)`,
      [id, organizationId, `GateProbe Project`, ownerId]
    );
  });
  return id;
}

/** Odczyt NA ZIMNO: osobne połączenie pg, poza pulą aplikacji. */
async function coldCount(sql: string, params: unknown[]): Promise<number> {
  return withClient(async (client) => {
    const r = await client.query(sql, params);
    return Number(r.rows[0]?.n ?? 0);
  });
}

interface Position {
  id: string;
  mount: string;
  moduleId: string;
  /** Zapis wykonywany przez wskazaną tożsamość. */
  write: (
    who: Identity,
    marker: string,
    projectId: string
  ) => Promise<{ status: number; body: Json }>;
  /** Liczba wierszy widzianych NA ZIMNO po zapisie. */
  cold: (who: Identity, marker: string) => Promise<number>;
  /** Status oznaczający sukces zapisu. */
  okStatus: number;
}

const POSITIONS: Position[] = [
  {
    id: 'economics',
    mount: '/api/economics',
    moduleId: 'MODULE_ECONOMICS',
    okStatus: 201,
    write: (who, marker) =>
      requestJson('POST', '/api/economics/analyses', { token: who.token, body: { name: marker } }),
    cold: (who, marker) =>
      coldCount(
        'SELECT count(*)::int AS n FROM digitization_analyses WHERE organization_id = $1 AND name = $2',
        [who.organizationId, marker]
      ),
  },
  {
    id: 'financial-modeling',
    mount: '/api/financial-modeling',
    moduleId: 'MODULE_ECONOMICS',
    okStatus: 201,
    write: (who, marker) =>
      requestJson('POST', '/api/financial-modeling/models', {
        token: who.token,
        body: { name: marker, startDate: '2026-01-01', currency: 'EUR', horizonMonths: 12 },
      }),
    cold: (who, marker) =>
      coldCount(
        'SELECT count(*)::int AS n FROM financial_models WHERE organization_id = $1 AND name = $2',
        [who.organizationId, marker]
      ),
  },
  {
    id: 'conclusions',
    mount: '/api/conclusions',
    moduleId: 'MODULE_CONCLUSIONS',
    okStatus: 201,
    write: (who, marker) =>
      requestJson('POST', '/api/conclusions', {
        token: who.token,
        body: {
          title: marker,
          statement: `Statement for ${marker}`,
          sourceModule: 'gate-probe',
          sourceRefs: [{ type: 'probe', id: marker }],
        },
      }),
    cold: (who, marker) =>
      coldCount(
        'SELECT count(*)::int AS n FROM conclusions WHERE organization_id = $1 AND title = $2',
        [who.organizationId, marker]
      ),
  },
  {
    id: 'case-workspace',
    mount: '/api/v8/case-workspace',
    moduleId: 'MODULE_CASE_WORKSPACE',
    okStatus: 201,
    write: (who, marker, projectId) =>
      requestJson('POST', '/api/v8/case-workspace/cases', {
        token: who.token,
        body: {
          projectId,
          caseName: marker,
          contractedClosureType: 'DELIVERY_COMPLETED',
        },
      }),
    cold: (who, marker) =>
      coldCount(
        'SELECT count(*)::int AS n FROM case_core WHERE organization_id = $1 AND case_name = $2',
        [who.organizationId, marker]
      ),
  },
];

async function run(): Promise<void> {
  const nonce = Date.now();
  const only = String(process.env.GATE_PROBE_ONLY || '').trim();
  const positions = only ? POSITIONS.filter((p) => p.id === only) : POSITIONS;
  assert.ok(positions.length > 0, `unknown GATE_PROBE_ONLY=${only}`);

  const emailOwner = `gateprobe+owner-${nonce}@local.test`;
  const emailUser = `gateprobe+user-${nonce}@local.test`;

  await register(emailOwner, `GateProbe Owner Org ${nonce}`);
  await register(emailUser, `GateProbe User Org ${nonce}`);
  await demoteToUser(emailUser);

  const owner = await login(emailOwner);
  const user = await login(emailUser);

  const ownerProject = await createProjectCold(owner.organizationId, owner.userId);
  const userProject = await createProjectCold(user.organizationId, user.userId);

  const out: Json = { roles: { owner: owner.role, user: user.role }, positions: {} };

  for (const position of positions) {
    const negMarker = `GateProbe NEG ${position.id} ${nonce}`;
    const posMarker = `GateProbe POS ${position.id} ${nonce}`;

    const negWrite = await position.write(user, negMarker, userProject);
    const negCold = await position.cold(user, negMarker);

    const posWrite = await position.write(owner, posMarker, ownerProject);
    const posCold = await position.cold(owner, posMarker);

    const blocked =
      negWrite.status === 403 && negWrite.body?.code === 'BETA_LOCKED' && negCold === 0;
    const allowed = posWrite.status === position.okStatus && posCold === 1;

    out.positions[position.id] = {
      mount: position.mount,
      moduleId: position.moduleId,
      negative: {
        role: user.role,
        status: negWrite.status,
        code: negWrite.body?.code ?? null,
        error: negWrite.body?.error ?? null,
        coldRowCount: negCold,
        blocked,
      },
      positive: {
        role: owner.role,
        status: posWrite.status,
        code: posWrite.body?.code ?? null,
        error: posWrite.body?.error ?? null,
        coldRowCount: posCold,
        allowed,
      },
      pass: blocked && allowed,
    };
  }

  // ── OBSERWACJE (mierzymy, NIE naprawiamy) ────────────────────────────────
  // Siostrzane powierzchnie tych samych zamkniętych modułów. Zapisujemy stan
  // do rejestru; decyzja o bramce należy do nadzorcy (część z nich ma własne
  // ściany autoryzacyjne, część nie ma żadnego uprawnionego wołacza z JWT).
  const OBSERVED: Array<{ id: string; method: string; path: string; body?: Json }> = [
    {
      id: 'v8-finance-digitization-read',
      method: 'GET',
      path: '/api/v8/finance/digitization-analyses',
    },
    {
      id: 'v8-finance-digitization-write',
      method: 'POST',
      path: '/api/v8/finance/digitization-analyses',
      body: { name: `GateProbe OBS ${nonce}` },
    },
    { id: 'finance-statements-read', method: 'GET', path: '/api/finance-statements/' },
    { id: 'finance-v4-read', method: 'GET', path: '/api/finance-v4/overview' },
    {
      id: 'webhooks-case-workspace',
      method: 'POST',
      path: '/api/webhooks/case-workspace/probe/deliveries',
      body: { eventId: `obs-${nonce}`, eventType: 'probe.test', organizationId: 'x', payload: {} },
    },
    { id: 'case-workspace-subtree-read', method: 'GET', path: '/api/v8/case-workspace/cases' },
    { id: 'economics-read', method: 'GET', path: '/api/economics/analyses' },
    { id: 'conclusions-read', method: 'GET', path: '/api/conclusions' },
    // Reszta rodziny MODULE_CASE_WORKSPACE: intake Case'a z powierzchni CHATU
    // i TERESY (osobne prefiksy, poza mountem /case-workspace). Mierzymy
    // wyłącznie osiągalność (brak BETA_LOCKED) — naprawa wymaga własnej pary
    // dowodów na pełnym przepływie intake, więc zostaje w rejestrze.
    {
      id: 'chat-case-intake',
      method: 'POST',
      path: '/api/v8/chat/conversations/gateprobe-x/case-intake/turn',
      body: { message: 'probe' },
    },
    {
      id: 'teresa-case-intake',
      method: 'POST',
      path: '/api/v8/teresa/case-intake/conversations/gateprobe-x/confirm',
      body: {},
    },
    // Kontrola ANTY-WYGASZENIOWA: powierzchnie modułów OTWARTYCH, które
    // sąsiadują z naprawionymi mountami, muszą dalej działać dla roli USER.
    {
      id: 'anti-extinction-artifact-conversions',
      method: 'GET',
      path: '/api/artifact-conversions',
    },
    { id: 'anti-extinction-my-work', method: 'GET', path: '/api/my-work/inbox' },
  ];
  out.observations = {};
  for (const o of OBSERVED) {
    const asUser = await requestJson(o.method, o.path, { token: user.token, body: o.body });
    const asOwner = await requestJson(o.method, o.path, { token: owner.token, body: o.body });
    out.observations[o.id] = {
      path: `${o.method} ${o.path}`,
      user: { status: asUser.status, code: asUser.body?.code ?? null },
      owner: { status: asOwner.status, code: asOwner.body?.code ?? null },
      userReachesModule: asUser.status !== 403 || asUser.body?.code !== 'BETA_LOCKED',
    };
  }

  out.verdict = {
    pass: Object.values(out.positions).every((p: any) => p.pass),
    failing: Object.entries(out.positions)
      .filter(([, p]: [string, any]) => !p.pass)
      .map(([id]) => id),
  };

  console.log(JSON.stringify(out, null, 2));

  if (process.env.GATE_PROBE_CLEANUP === '1') {
    await withClient(async (client) => {
      const orgs = [user.organizationId, owner.organizationId];
      await client.query('DELETE FROM case_core WHERE organization_id = ANY($1::text[])', [orgs]);
      await client.query('DELETE FROM conclusions WHERE organization_id = ANY($1::text[])', [orgs]);
      await client.query('DELETE FROM financial_models WHERE organization_id = ANY($1::text[])', [
        orgs,
      ]);
      await client.query(
        'DELETE FROM digitization_analyses WHERE organization_id = ANY($1::text[])',
        [orgs]
      );
      await client.query('DELETE FROM projects WHERE organization_id = ANY($1::text[])', [orgs]);
    });
    console.log(JSON.stringify({ cleanup: 'probe rows removed' }));
  }
}

async function main(): Promise<void> {
  const app: Express = express();
  app.use(express.json({ limit: '2mb' }));
  const { ApiGateway } = await import('../Gateway.js');
  ApiGateway.getInstance().initializeRoutes(app);
  app.use(
    (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[gate-probe] unhandled route error', error?.message || error);
      const status = Number(error?.statusCode || error?.status || 500);
      res.status(Number.isFinite(status) && status >= 400 && status < 600 ? status : 500).json({
        error: error?.code || 'gate_probe_harness_error',
        detail: String(error?.message || error),
      });
    }
  );
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
    console.error('[gate-probe] FAILED', error);
    process.exit(1);
  }
);
