import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import express, { type Express } from 'express';

const REPO = path.resolve(import.meta.dirname, '../../..');
const CONTAINER = 'cx-day283-pg';
const DATABASE_PORT = 6284;
const DATABASE_NAME = 'cx283';
const DATABASE_URL = `postgresql://postgres:cx@127.0.0.1:${DATABASE_PORT}/${DATABASE_NAME}`;
const IMAGE = 'pgvector/pgvector:pg16';
const PASSWORD = 'Day283-Local-Only-Password-1';
const EVIDENCE_DIR = path.join(
  REPO,
  'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day283-g01-environment'
);
const ARTIFACT_DIR = '/private/tmp/cx-day283-kwalifikacja-artefakty';

const MODULES = [
  '01_ORGANIZATION',
  '02_INTERVIEW',
  '03_TOOLS',
  '04_ASSESSMENT',
  '05_INITIATIVES',
  '06_EXECUTION',
  '07_MY_WORK_AGENT',
  '08_MEETINGS',
  '09_RESULTS',
  '10_FINANCE',
  '11_MATERIALS',
  '12_AUDITS',
  '13_CHAT',
  '14_ADMIN',
  '15_SETTINGS',
  '16_PARTNER',
] as const;

type Json = Record<string, any>;

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  assert.ok(index >= 0 && process.argv[index + 1], `missing ${name}`);
  return process.argv[index + 1];
}

const moduleName = argument('--module');
assert.ok(
  MODULES.includes(moduleName as (typeof MODULES)[number]),
  `unknown module: ${moduleName}`
);
const port = Number(argument('--port'));
assert.ok(port === 5288 || port === 5289, 'harness port must be 5288 or 5289');

const REQUIRED_ENV: Record<string, string> = {
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
  DB_TYPE: 'postgres',
  NODE_ENV: 'test',
  ENABLE_V8_GLOBAL: 'true',
  ENABLE_TEST_AUTH_BYPASS: 'false',
  RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE: 'enforce',
  CI: 'true',
  DATABASE_URL,
};
for (const [name, expected] of Object.entries(REQUIRED_ENV)) {
  assert.equal(process.env[name], expected, `${name} must equal ${expected}`);
}
assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be set');

function run(command: string, args: string[], options: { capture?: boolean } = {}): string {
  const result = spawnSync(command, args, {
    cwd: REPO,
    encoding: 'utf8',
    env: process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status}): ${result.stderr || ''}`
    );
  }
  return options.capture ? (result.stdout || '').trim() : '';
}

function removeOwnContainer(): void {
  const present = spawnSync('docker', ['inspect', CONTAINER], { stdio: 'ignore' }).status === 0;
  if (present) run('docker', ['rm', '-fv', CONTAINER]);
}

function prepareFreshDatabase(): {
  migrationCount: number;
  imageDigest: string;
  secondRunApplied: number;
} {
  removeOwnContainer();
  run('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    'POSTGRES_PASSWORD=cx',
    '-e',
    `POSTGRES_DB=${DATABASE_NAME}`,
    '-p',
    `127.0.0.1:${DATABASE_PORT}:5432`,
    IMAGE,
  ]);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (
      spawnSync('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' })
        .status === 0
    )
      break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    assert.notEqual(attempt, 59, 'PostgreSQL did not become ready');
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const migrationScript = ['tsx', 'server/scripts/migrate.postgres.ts'];
  const first = run('npx', migrationScript, { capture: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${moduleName}-migrations-1.log`), `${first}\n`);
  const second = run('npx', migrationScript, { capture: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${moduleName}-migrations-2.log`), `${second}\n`);
  const secondMatch = second.match(/Applying migrations:\s*(\d+)/);
  assert.equal(Number(secondMatch?.[1]), 0, `second migration run was not idle: ${second}`);

  const migrationCount = Number(
    run(
      'docker',
      [
        'exec',
        CONTAINER,
        'psql',
        '-U',
        'postgres',
        '-d',
        DATABASE_NAME,
        '-At',
        '-c',
        'SELECT count(*) FROM schema_migrations;',
      ],
      { capture: true }
    )
  );
  assert.ok(migrationCount > 0, 'schema_migrations is empty');
  const smtpRows = run(
    'docker',
    [
      'exec',
      CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      DATABASE_NAME,
      '-At',
      '-c',
      "SELECT count(*) FROM settings WHERE key LIKE 'smtp%';",
    ],
    { capture: true }
  );
  assert.equal(smtpRows, '0', 'SMTP configuration exists in disposable database');
  const imageDigest = run('docker', ['inspect', CONTAINER, '--format', '{{.Image}}'], {
    capture: true,
  });
  return { migrationCount, imageDigest, secondRunApplied: 0 };
}

async function requestJson(
  method: string,
  requestPath: string,
  options: { token?: string; body?: Json } = {}
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
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
  try {
    return { status: response.status, body: text ? JSON.parse(text) : {} };
  } catch {
    return { status: response.status, body: { raw: text } };
  }
}

async function qualifyHttpPath(): Promise<{
  registration: number;
  login: number;
  coldRead: number;
  matched: boolean;
}> {
  const nonce = `${process.pid}-${Date.now()}`;
  const email = `day283-${moduleName.toLowerCase()}-${nonce}@local.test`;
  const companyName = `Day283 ${moduleName} ${nonce}`;
  const registration = await requestJson('POST', '/api/auth/register', {
    body: {
      email,
      password: PASSWORD,
      firstName: 'Day283',
      lastName: 'Qualification',
      companyName,
      isDemo: true,
    },
  });
  assert.equal(
    registration.status,
    200,
    `registration failed: ${JSON.stringify(registration.body)}`
  );
  const organizationId = registration.body.user?.organizationId;
  assert.ok(organizationId, 'registration did not return organizationId');

  const login = await requestJson('POST', '/api/auth/login', {
    body: { email, password: PASSWORD },
  });
  assert.equal(login.status, 200, `login failed: ${JSON.stringify(login.body)}`);
  assert.ok(login.body.token, 'login did not issue signed JWT');

  const coldRead = await requestJson('GET', `/api/organizations/${organizationId}`, {
    token: login.body.token,
  });
  const organization = coldRead.body.organization || coldRead.body;
  assert.equal(coldRead.status, 200, `cold read failed: ${JSON.stringify(coldRead.body)}`);
  assert.equal(organization.id, organizationId);
  assert.equal(organization.name, companyName);
  return {
    registration: registration.status,
    login: login.status,
    coldRead: coldRead.status,
    matched: true,
  };
}

async function main(): Promise<void> {
  const database = prepareFreshDatabase();
  const app: Express = express();
  app.use(express.json({ limit: '2mb' }));
  const { ApiGateway } = await import('../Gateway.js');
  ApiGateway.getInstance().initializeRoutes(app);
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[g01-environment-qualification] route error', error);
      res.status(500).json({ error: 'g01_environment_qualification_error' });
    }
  );
  const server = app.listen(port, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const http = await qualifyHttpPath();
    const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO,
      encoding: 'utf8',
    }).trim();
    const command = `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce CI=true DATABASE_URL=${DATABASE_URL} JWT_SECRET=day283-test-secret-do-not-reuse npx tsx server/src/scripts/g01-environment-qualification.ts --module ${moduleName} --port ${port}`;
    const manifest = {
      schemaVersion: 1,
      module: moduleName,
      result: 'PASS',
      gitSha,
      clientStarted: false,
      server: {
        gateway: 'ApiGateway.getInstance().initializeRoutes(app)',
        host: '127.0.0.1',
        port,
      },
      database: {
        image: IMAGE,
        imageDigest: database.imageDigest,
        port: DATABASE_PORT,
        name: DATABASE_NAME,
      },
      migrations: { applied: database.migrationCount, secondRunApplied: database.secondRunApplied },
      http: {
        registration: http.registration,
        signedJwtLogin: http.login,
        coldRead: http.coldRead,
        matched: http.matched,
      },
      reproductionCommand: command,
    };
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const manifestPath = path.join(EVIDENCE_DIR, `${moduleName}.json`);
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    fs.writeFileSync(manifestPath, serialized);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    fs.writeFileSync(`${manifestPath}.sha256`, `${checksum}  ${path.basename(manifestPath)}\n`);
    console.log(JSON.stringify({ manifestPath, checksum, manifest }, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    removeOwnContainer();
  }
}

main().catch((error) => {
  console.error('[g01-environment-qualification] FAILED', error);
  removeOwnContainer();
  process.exit(1);
});
