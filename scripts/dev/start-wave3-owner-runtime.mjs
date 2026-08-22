#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';
const root = process.cwd(),
  cmd = process.argv[2] || 'status',
  protectedPorts = new Set([3940, 3941]),
  localHosts = new Set(['127.0.0.1', 'localhost', '::1']),
  // Adopt only fixture families that currently implement the complete FINAL
  // receipt + durable marker contract. Extend this allowlist only together
  // with the corresponding fixture migration and executable preservation test.
  adoptedFixtureContracts = [
    {
      databasePattern: /^consultify_w3_organization_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-ORGANIZATION-OWNER-v1',
      fixture: 'W3-ORGANIZATION-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_finance_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-FINANCE-OWNER-v1',
      fixture: 'wave3-finance-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_chat_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-CHAT-OWNER-v1',
      fixture: 'wave3-chat-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_results_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-RESULTS-OWNER-v1',
      fixture: 'wave3-results-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_materials_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-MATERIALS-OWNER-v1',
      fixture: 'wave3-materials-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_audits_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-AUDITS-OWNER-v1',
      fixture: 'wave3-audits-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_execution_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-EXECUTION-OWNER-v1',
      fixture: 'wave3-execution-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_assessment_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-ASSESSMENT-OWNER-v1',
      fixture: 'W3-ASSESSMENT-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_admin_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-ADMIN-OWNER-v1',
      fixture: 'W3-ADMIN-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_interview_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-INTERVIEW-OWNER-v1',
      fixture: 'W3-INTERVIEW-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_tools_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-TOOLS-OWNER-v1',
      fixture: 'W3-TOOLS-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_meetings_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-MEETINGS-OWNER-v1',
      fixture: 'wave3-meetings-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_initiatives_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-INITIATIVES-OWNER-v1',
      fixture: 'W3-INITIATIVES-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_partner_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-PARTNER-OWNER-v1',
      fixture: 'wave3-partner-owner-review-v1',
    },
    {
      databasePattern: /^consultify_w3_my_work_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-MY-WORK-OWNER-v1',
      fixture: 'W3-MY-WORK-OWNER-v1',
    },
    {
      databasePattern: /^consultify_w3_settings_owner_[a-z0-9_]+$/,
      fixtureId: 'W3-SETTINGS-OWNER-v1',
      fixture: 'W3-SETTINGS-OWNER-v1',
    },
  ],
  runtimeSecrets = [];
const fail = (m) => {
    throw new Error(`[W3 runtime] BLOCKED: ${m}`);
  },
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (a) => {
  const r = spawnSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (r.status !== 0) fail(`git ${a.join(' ')} failed`);
  return r.stdout;
};
export function currentDirtyFingerprint() {
  const h = crypto.createHash('sha256');
  h.update(git(['diff', '--binary', 'HEAD']));
  for (const f of git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .sort()) {
    h.update(`\0${f}\0`);
    h.update(fs.readFileSync(path.join(root, f)));
  }
  return h.digest('hex');
}
function directTmp(input, label, prefix, mustNotExist = false) {
  if (
    !input ||
    !path.isAbsolute(input) ||
    path.normalize(input) !== input ||
    input.split(path.sep).includes('..')
  )
    fail(`${label} must be normalized absolute without ..`);
  const tmp = fs.realpathSync('/tmp'),
    parent = fs.realpathSync(path.dirname(input));
  if (parent !== tmp || !path.basename(input).startsWith(prefix))
    fail(`${label} must be a direct /tmp child named ${prefix}*`);
  if (fs.existsSync(input) && fs.lstatSync(input).isSymbolicLink())
    fail(`${label} must not be a symlink`);
  if (mustNotExist && fs.existsSync(input)) fail(`${label} exists; overwrite refused`);
  return path.join(tmp, path.basename(input));
}
function parseDb(raw, mode) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('WAVE3_RUNTIME_DATABASE_URL is invalid');
  }
  const name = url.pathname.slice(1),
    port = Number(url.port || 5432);
  const validName =
    mode === 'create'
      ? /^consultify_w3_runtime_[a-z0-9_]+$/.test(name)
      : adoptedFixtureContracts.some((contract) => contract.databasePattern.test(name));
  if (!localHosts.has(url.hostname) || !validName)
    fail(
      mode === 'create'
        ? 'runtime DB must be local and named consultify_w3_runtime_*'
        : 'adopted DB must be local and match the closed Wave3 owner prefix allowlist'
    );
  if (!url.username || !Number.isInteger(port)) fail('runtime DB user/port required');
  return {
    url,
    configured: { host: url.hostname, port, user: decodeURIComponent(url.username), name },
  };
}
function fixtureManifest(raw, dbName) {
  if (!raw || !path.isAbsolute(raw)) fail('WAVE3_RUNTIME_FIXTURE_MANIFEST must be absolute');
  if (!fs.existsSync(raw)) fail('fixture manifest must exist');
  if (fs.lstatSync(raw).isSymbolicLink()) fail('fixture manifest must not be a symlink');
  const file = fs.realpathSync(raw);
  const stat = fs.statSync(file);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
    fail('fixture manifest must be an existing regular 0600 file');
  const bytes = fs.readFileSync(file);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('fixture manifest must be valid JSON');
  }
  if (value?.databaseName !== dbName) fail('fixture manifest databaseName differs from runtime DB');
  if (value?.ownershipState !== 'FINAL')
    fail('fixture manifest must be a finalized owner-fixture receipt');
  const contract = adoptedFixtureContracts.find((candidate) =>
    candidate.databasePattern.test(dbName)
  );
  if (!contract) fail('adopted fixture family contract is missing');
  const fixtureId = value?.fixtureId,
    ownershipNonce = value?.ownershipNonce,
    marker = value?.marker;
  if (
    fixtureId !== contract.fixtureId ||
    value?.fixture !== contract.fixture ||
    typeof ownershipNonce !== 'string' ||
    !/^[a-f0-9]{32,128}$/.test(ownershipNonce) ||
    marker?.table !== 'wave3_owner_fixture_markers' ||
    marker?.fixtureId !== fixtureId ||
    marker?.ownershipNonce !== ownershipNonce
  )
    fail('fixture manifest ownership marker contract is invalid for the adopted database family');
  return {
    path: file,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    fixtureId,
    ownershipNonce,
  };
}
function validate() {
  if (!['fingerprint', 'start', 'status', 'stop'].includes(cmd)) fail(`unknown command ${cmd}`);
  const sha = git(['rev-parse', 'HEAD']).trim(),
    currentFp = currentDirtyFingerprint();
  if (cmd === 'fingerprint') {
    console.log(
      JSON.stringify(
        {
          sha,
          dirtyFingerprint: currentFp,
          dirty: git(['status', '--porcelain=v1']).trim() !== '',
        },
        null,
        2
      )
    );
    return { probe: true };
  }
  if (process.env.WAVE3_RUNTIME_CONFIRM !== 'YES') fail('WAVE3_RUNTIME_CONFIRM=YES is required');
  if (process.env.WAVE3_RUNTIME_EXPECTED_SHA !== sha)
    fail(`WAVE3_RUNTIME_EXPECTED_SHA must equal current HEAD ${sha}`);
  const suppliedFp = process.env.WAVE3_RUNTIME_DIRTY_FINGERPRINT || '';
  if (!suppliedFp) fail('WAVE3_RUNTIME_DIRTY_FINGERPRINT is required');
  if (cmd !== 'stop' && suppliedFp !== currentFp)
    fail(`WAVE3_RUNTIME_DIRTY_FINGERPRINT must equal current fingerprint ${currentFp}`);
  const mode = process.env.WAVE3_RUNTIME_MODE || 'create';
  if (!['create', 'adopt-existing'].includes(mode))
    fail('WAVE3_RUNTIME_MODE must be create or adopt-existing');
  const db = parseDb(process.env.WAVE3_RUNTIME_DATABASE_URL || '', mode),
    fixture =
      mode === 'adopt-existing'
        ? fixtureManifest(process.env.WAVE3_RUNTIME_FIXTURE_MANIFEST || '', db.configured.name)
        : null,
    manifestPath = directTmp(
      process.env.WAVE3_RUNTIME_MANIFEST || '',
      'manifest',
      'consultify-wave3-runtime-manifest-',
      cmd === 'start'
    ),
    stateDir = directTmp(
      process.env.WAVE3_RUNTIME_STATE_DIR || '',
      'state directory',
      'consultify-wave3-runtime-',
      cmd === 'start'
    ),
    serverPort = Number(process.env.WAVE3_RUNTIME_SERVER_PORT || 0),
    clientPort = Number(process.env.WAVE3_RUNTIME_CLIENT_PORT || 0);
  for (const [n, p] of [
    ['server', serverPort],
    ['client', clientPort],
  ])
    if (!Number.isInteger(p) || p < 1024 || p > 65535 || protectedPorts.has(p))
      fail(`${n} port must be 1024..65535 and not 3940/3941`);
  if (serverPort === clientPort) fail('client and server ports must differ');
  return {
    probe: false,
    sha,
    fingerprint: cmd === 'stop' ? suppliedFp : currentFp,
    db,
    mode,
    fixture,
    manifestPath,
    stateDir,
    serverPort,
    clientPort,
  };
}
function writeExclusive(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
  } finally {
    fs.closeSync(fd);
  }
  if ((fs.statSync(file).mode & 0o777) !== 0o600) fail(`${file} mode is not 0600`);
}
function rewriteState(file, value) {
  const tmp = `${file}.next`;
  writeExclusive(tmp, value);
  fs.renameSync(tmp, file);
}
function identity(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return '';
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='], {
    encoding: 'utf8',
  });
  return r.status === 0 ? r.stdout.trim() : '';
}
const portFree = (p) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)));
  });
function listenerPids(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean).map(Number) : [];
}
function processGroup(pid) {
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'pgid='], { encoding: 'utf8' });
  return r.status === 0 ? Number(r.stdout.trim()) : 0;
}
function processAlive(pid) {
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' });
  return r.status === 0 && Boolean(r.stdout.trim()) && !r.stdout.trim().startsWith('Z');
}
const prohibitedKey =
  /^(OPENAI|ANTHROPIC|GROQ|GEMINI|GOOGLE_AI|GOOGLE_API|AWS|AZURE|RAILWAY|SUPABASE|STRIPE|SENDGRID|SLACK|CLOUDFLARE|VERCEL|SENTRY)(_|$)/i;
function knownProhibitedSecrets() {
  const values = [];
  for (const file of ['.env', '.env.local', 'server/.env', 'server/.env.local'])
    if (fs.existsSync(file))
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && prohibitedKey.test(m[1])) {
          const value = m[2].replace(/^['"]|['"]$/g, '');
          if (value) values.push(value);
        }
      }
  return values;
}
function processEnvironment(pid) {
  const r = spawnSync('ps', ['eww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : '';
}
function enumerateProcessGroup(pgid) {
  const r = spawnSync('pgrep', ['-g', String(pgid)], { encoding: 'utf8' });
  if (r.status === 1) return [];
  if (r.status !== 0) fail(`cannot enumerate owned PGID ${pgid}`);
  return r.stdout.split('\n').filter(Boolean).map(Number);
}
function processGroupPids(pgid) {
  const pids = enumerateProcessGroup(pgid);
  if (!pids.length) fail(`owned PGID ${pgid} is unexpectedly empty`);
  return pids;
}
function ownedGroupEnvironments(...records) {
  const evidence = [];
  for (const record of records)
    for (const pid of processGroupPids(record.pgid)) {
      const body = processEnvironment(pid);
      if (!body) fail(`cannot read environment evidence for owned PID ${pid}`);
      evidence.push({ pid, body });
    }
  return evidence;
}
async function stageProcess(child, label, state, stateFile) {
  let spawnError = null,
    exited = null;
  child.once('error', (e) => {
    spawnError = e;
  });
  child.once('exit', (code, signal) => {
    exited = { code, signal };
  });
  child.unref();
  await sleep(400);
  if (spawnError) fail(`${label} spawn error: ${spawnError.message}`);
  if (exited) fail(`${label} exited during ownership staging`);
  const record = { pid: child.pid, pgid: processGroup(child.pid), identity: identity(child.pid) };
  if (!record.identity || record.pgid !== child.pid) fail(`${label} identity/PGID invalid`);
  state[label] = record;
  state.stage = `${label.toUpperCase()}_OWNED`;
  rewriteState(stateFile, state);
  return record;
}
async function waitHttp(url, timeout = 120000) {
  const until = Date.now() + timeout;
  let last = '';
  while (Date.now() < until) {
    try {
      const r = await fetch(url),
        body = await r.text();
      last = `HTTP ${r.status}`;
      if (r.ok) return { status: r.status, body };
    } catch (e) {
      last = String(e);
    }
    await sleep(500);
  }
  fail(`${url} not ready: ${last}`);
}
function childEnv(extra = {}) {
  const keys = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SHELL', 'TERM'],
    env = Object.fromEntries(keys.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
  return { ...env, CI: 'true', ...extra };
}
function scan(files, secrets = runtimeSecrets) {
  const uri = /postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i,
    jwtShape = /\b[a-f0-9]{96}\b/i;
  for (const f of files)
    if (fs.existsSync(f)) {
      const body = fs.readFileSync(f, 'utf8');
      if (
        uri.test(body) ||
        jwtShape.test(body) ||
        secrets.filter(Boolean).some((secret) => body.includes(secret))
      )
        fail(`secret value found in ${f}`);
    }
}
const exists = async (a, n) =>
  Number(
    (await a.query('select count(*)::int n from pg_database where datname=$1', [n])).rows[0].n
  ) === 1;
function adminUrl(db) {
  const u = new URL(db.url);
  u.pathname = '/postgres';
  return u.toString();
}
async function bind(c, state) {
  if (JSON.stringify(c.db.configured) !== JSON.stringify(state.database.configured))
    fail('database host/port/user/name differs from owned state');
  const admin = new pg.Client({ connectionString: adminUrl(c.db) });
  await admin.connect();
  try {
    if (!(await exists(admin, c.db.configured.name))) return { admin, exists: false };
    const owner = (
      await admin.query('select pg_get_userbyid(datdba) owner from pg_database where datname=$1', [
        c.db.configured.name,
      ])
    ).rows[0]?.owner;
    if (owner !== c.db.configured.user) fail('database owner differs from owned state');
    return { admin, exists: true };
  } catch (e) {
    await admin.end();
    throw e;
  }
}
async function verifyAdoptedMarker(c) {
  if (c.mode !== 'adopt-existing') return;
  const client = new pg.Client({ connectionString: c.db.url.toString() });
  await client.connect();
  try {
    const table = await client.query(
      `select to_regclass('public.wave3_owner_fixture_markers')::text name`
    );
    if (table.rows[0]?.name !== 'wave3_owner_fixture_markers')
      fail('adopted DB ownership marker table is absent');
    const marker = await client.query(
      `select database_name from public.wave3_owner_fixture_markers
       where fixture_id=$1 and ownership_nonce=$2`,
      [c.fixture.fixtureId, c.fixture.ownershipNonce]
    );
    if (marker.rowCount !== 1 || marker.rows[0].database_name !== c.db.configured.name)
      fail('adopted DB ownership marker does not exactly match fixture manifest');
  } finally {
    await client.end();
  }
}
function signalGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}
async function terminate(p) {
  if (!p?.pid) return { pgid: null, terminated: true, survivors: [] };
  const now = identity(p.pid);
  if (!now || !processAlive(p.pid)) {
    const survivors = enumerateProcessGroup(p.pgid).filter(processAlive);
    if (survivors.length) fail(`owned PGID ${p.pgid} has survivors without its leader`);
    return { pgid: p.pgid, terminated: true, survivors: [] };
  }
  if (
    !p.identity ||
    now !== p.identity ||
    !p.pgid ||
    processGroup(p.pid) !== p.pgid ||
    p.pgid !== p.pid
  )
    fail('PID identity/PGID missing or changed; refusing signal');
  signalGroup(p.pgid, 'SIGTERM');
  let survivors = enumerateProcessGroup(p.pgid).filter(processAlive);
  for (let i = 0; i < 30 && survivors.length; i++) {
    await sleep(200);
    survivors = enumerateProcessGroup(p.pgid).filter(processAlive);
  }
  if (survivors.length) {
    if (processAlive(p.pid) && (identity(p.pid) !== p.identity || processGroup(p.pid) !== p.pgid))
      fail('PID identity/PGID changed during stop');
    signalGroup(p.pgid, 'SIGKILL');
    for (let i = 0; i < 20; i++) {
      survivors = enumerateProcessGroup(p.pgid).filter(processAlive);
      if (!survivors.length) break;
      await sleep(100);
    }
  }
  survivors = enumerateProcessGroup(p.pgid).filter(processAlive);
  if (survivors.length) fail(`owned PGID ${p.pgid} survived termination: ${survivors.join(',')}`);
  return { pgid: p.pgid, terminated: true, survivors: [] };
}
async function cleanup(c, state) {
  const processGroupProof = [await terminate(state.client), await terminate(state.server)];
  state.cleanupProof = { processGroupsVerifiedTerminated: true, processGroupProof };
  state.stage = 'PROCESSES_TERMINATED';
  const stateFile = path.join(c.stateDir, 'state.json');
  if (fs.existsSync(stateFile)) rewriteState(stateFile, state);
  else writeExclusive(stateFile, state);
  const b = await bind(c, state);
  try {
    if (b.exists && c.mode === 'create')
      await b.admin.query(`drop database "${c.db.configured.name}" with (force)`);
  } finally {
    await b.admin.end();
  }
  if (listenerPids(c.serverPort).length || listenerPids(c.clientPort).length)
    fail('owned runtime port remains busy after stop');
}
async function start(c) {
  if (!(await portFree(c.serverPort)) || !(await portFree(c.clientPort)))
    fail('requested isolated port is busy');
  fs.mkdirSync(c.stateDir, { mode: 0o700 });
  const stateFile = path.join(c.stateDir, 'state.json'),
    state = {
      schema: 'W3-RUNTIME-STATE-v2',
      sha: c.sha,
      fingerprint: c.fingerprint,
      mode: c.mode,
      fixture: c.fixture,
      database: { configured: c.db.configured, preserved: c.mode === 'adopt-existing' },
      server: null,
      client: null,
      stage: 'ALLOCATING_DB',
    };
  let cleanupArmed = false,
    interrupted = false,
    cleanupPromise = null,
    activeOwnershipStage = Promise.resolve();
  const runCleanup = () => (cleanupPromise ||= cleanup(c, state));
  const stopForwardProgress = () => interrupted;
  const onInterrupt = (signal) => {
    if (interrupted) return;
    interrupted = true;
    void activeOwnershipStage
      .catch(() => undefined)
      .then(() => (cleanupArmed ? runCleanup() : undefined))
      .then(() => process.exit(signal === 'SIGINT' ? 130 : 143))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  };
  process.once('SIGINT', () => onInterrupt('SIGINT'));
  process.once('SIGTERM', () => onInterrupt('SIGTERM'));
  try {
    activeOwnershipStage = (async () => {
      const admin = new pg.Client({ connectionString: adminUrl(c.db) });
      await admin.connect();
      try {
        const present = await exists(admin, c.db.configured.name);
        if (c.mode === 'create') {
          if (present) fail('runtime database already exists');
          await admin.query(`create database "${c.db.configured.name}"`);
          cleanupArmed = true;
        } else {
          if (!present) fail('adopted runtime database does not exist');
        }
        const delay = Number(process.env.WAVE3_RUNTIME_TEST_DB_STAGE_DELAY_MS || 0);
        if (delay > 0) await sleep(delay);
        if (process.env.WAVE3_RUNTIME_TEST_DB_STAGE_FAIL === '1')
          fail('injected database ownership stage failure');
      } finally {
        await admin.end();
      }
      if (c.mode === 'adopt-existing') {
        await verifyAdoptedMarker(c);
        cleanupArmed = true;
      }
      state.stage = c.mode === 'create' ? 'DB_CREATED' : 'DB_ADOPTED';
      writeExclusive(stateFile, state);
    })();
    await activeOwnershipStage;
    activeOwnershipStage = Promise.resolve();
    if (stopForwardProgress()) return;
    if (process.env.WAVE3_RUNTIME_FAIL_AT === 'after-db') fail('injected after-db failure');
    const migration = spawnSync(
      'npm',
      ['run', 'db:migrate:strict', ...(c.mode === 'adopt-existing' ? ['--', '--dry-run'] : [])],
      {
        cwd: root,
        env: childEnv({ NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: c.db.url.toString() }),
        encoding: 'utf8',
      }
    );
    if (stopForwardProgress()) return;
    if (migration.status !== 0) fail(`migration failed: ${migration.stderr || migration.stdout}`);
    if (c.mode === 'adopt-existing' && !/Pending migrations:\s*0\b/.test(migration.stdout))
      fail('adopted database does not match the exact source migration chain');
    if (process.env.WAVE3_RUNTIME_FAIL_AT === 'migration') fail('injected migration failure');
    const db = new pg.Client({ connectionString: c.db.url.toString() });
    await db.connect();
    const migrationRows = (
        await db.query(`select filename,status,checksum from schema_migrations order by filename`)
      ).rows,
      migrations = migrationRows.filter((row) => row.status === 'success').length,
      migrationChainSha256 = crypto
        .createHash('sha256')
        .update(JSON.stringify(migrationRows))
        .digest('hex'),
      invalidAdoptedChain =
        c.mode === 'adopt-existing' &&
        (!migrationRows.length ||
          migrationRows.some(
            (row) => row.status !== 'success' || !/^[a-f0-9]{64}$/.test(String(row.checksum || ''))
          )),
      actual = (
        await db.query(
          `select current_database() name,current_user "user",inet_server_addr()::text host,inet_server_port() port`
        )
      ).rows[0];
    await db.end();
    if (stopForwardProgress()) return;
    if (invalidAdoptedChain)
      fail('adopted schema_migrations is not an exact successful source chain');
    if (actual.name !== c.db.configured.name || actual.user !== c.db.configured.user)
      fail('live DB identity mismatch');
    state.database.actual = actual;
    state.database.migrations = migrations;
    state.database.migrationChainSha256 = migrationChainSha256;
    const sl = path.join(c.stateDir, 'server.log'),
      cl = path.join(c.stateDir, 'client.log'),
      sfd = fs.openSync(sl, 'wx', 0o600),
      cfd = fs.openSync(cl, 'wx', 0o600),
      jwt = crypto.randomBytes(48).toString('hex'),
      knownSecrets = knownProhibitedSecrets(),
      serverEnv = childEnv({
        NODE_ENV: 'development',
        DOTENV_DISABLED: '1',
        JWT_SECRET: jwt,
        DATABASE_URL: c.db.url.toString(),
        DB_TYPE: 'postgres',
        MOCK_DB: 'false',
        E2E_MODE: 'false',
        ENABLE_TEST_AUTH_BYPASS: 'false',
        ENABLE_TEST_GATEWAY: 'false',
        ENABLE_TEST_SUPPORT: 'false',
        ENABLE_V8_GLOBAL: 'true',
        ENABLE_V8_SHADOW_MODE: 'false',
        DISABLE_SCHEDULER: 'true',
        DISABLE_AI_PROVIDER_SENTINEL: 'true',
        DISABLE_AI_HEALTH_MONITOR: 'true',
        DISABLE_STARTUP_HEALTH_MONITOR: 'true',
        SKIP_STARTUP_VALIDATOR: 'true',
        // Exact owner fixtures are immutable evidence. Partner GET middleware
        // must not auto-seed development demo campaigns into an adopted DB.
        PARTNER_DEMO_SEED_ENABLED: 'false',
      });
    const clientEnv = childEnv({
      NODE_ENV: 'development',
      E2E_MODE: 'false',
      ENABLE_TEST_AUTH_BYPASS: 'false',
      ENABLE_TEST_GATEWAY: 'false',
      ENABLE_TEST_SUPPORT: 'false',
      VITE_DOTENV_DISABLED: '1',
      VITE_API_TARGET: `http://127.0.0.1:${c.serverPort}`,
      VITE_API_URL: '',
      VITE_BUILD_SHA: c.sha,
    });
    runtimeSecrets.push(jwt, ...knownSecrets);
    if (stopForwardProgress()) return;
    const server = spawn(path.join(root, 'node_modules/.bin/tsx'), ['server/src/index.ts'], {
      cwd: root,
      env: { ...serverEnv, PORT: String(c.serverPort), APP_BUILD_SHA: c.sha },
      detached: true,
      stdio: ['ignore', sfd, sfd],
    });
    activeOwnershipStage = stageProcess(server, 'server', state, stateFile);
    await activeOwnershipStage;
    activeOwnershipStage = Promise.resolve();
    if (stopForwardProgress()) return;
    if (
      process.env.WAVE3_RUNTIME_FAIL_AT === 'server-spawn' ||
      process.env.WAVE3_RUNTIME_FAIL_AT === 'spawn'
    )
      fail('injected server spawn failure');
    const client = spawn(
      path.join(root, 'node_modules/.bin/vite'),
      ['--host', '127.0.0.1', '--port', String(c.clientPort), '--strictPort'],
      {
        cwd: root,
        env: clientEnv,
        detached: true,
        stdio: ['ignore', cfd, cfd],
      }
    );
    activeOwnershipStage = stageProcess(client, 'client', state, stateFile);
    await activeOwnershipStage;
    activeOwnershipStage = Promise.resolve();
    if (stopForwardProgress()) return;
    fs.closeSync(sfd);
    fs.closeSync(cfd);
    if (process.env.WAVE3_RUNTIME_FAIL_AT === 'client-spawn') fail('injected client spawn failure');
    const health = await waitHttp(`http://127.0.0.1:${c.serverPort}/api/health`),
      // `/api/health/ready` proves only that PostgreSQL answers `SELECT 1`.
      // The authoritative traffic gate is `/api/ready`: it stays red until
      // schema verification, both migration ledgers and startup seeding have
      // all completed successfully.
      ready = await waitHttp(`http://127.0.0.1:${c.serverPort}/api/ready`),
      front = await waitHttp(`http://127.0.0.1:${c.clientPort}/`),
      marker = await waitHttp(
        `http://127.0.0.1:${c.clientPort}/src/services/feedbackCollector/AppContext.ts`
      );
    if (process.env.WAVE3_RUNTIME_FAIL_AT === 'readiness') fail('injected readiness failure');
    const hj = JSON.parse(health.body),
      rj = JSON.parse(ready.body),
      serverGroupEnvironments = ownedGroupEnvironments(state.server),
      clientGroupEnvironments = ownedGroupEnvironments(state.client),
      groupEnvironments = [...serverGroupEnvironments, ...clientGroupEnvironments],
      servedClient = `${front.body}\n${marker.body}`;
    for (const { pid, body } of groupEnvironments)
      for (const key of body.split(/\s+/).map((x) => x.split('=')[0]))
        if (prohibitedKey.test(key))
          fail(`prohibited environment key reached owned PID ${pid}: ${key}`);
    if (
      knownSecrets.some(
        (secret) =>
          groupEnvironments.some(({ body }) => body.includes(secret)) ||
          servedClient.includes(secret)
      )
    )
      fail('known prohibited dotenv secret reached runtime');
    if (
      clientGroupEnvironments.some(({ body }) => /(?:^|\s)(?:DATABASE_URL|JWT_SECRET)=/.test(body))
    )
      fail('server-only database/JWT credential reached Vite process group');
    if (hj.gitSha !== c.sha) fail('server health gitSha differs from exact candidate');
    if (
      rj.status !== 'ready' ||
      rj.database !== 'ready' ||
      rj.migrations?.state !== 'ok' ||
      rj.sqlMigrations?.state !== 'ok'
    )
      fail('authoritative server readiness contract is not fully green');
    if (rj.buildSha !== c.sha) fail('server readiness buildSha differs from exact candidate');
    if (!marker.body.includes(c.sha)) fail('client transformed marker lacks exact candidate SHA');
    await verifyAdoptedMarker(c);
    if (git(['rev-parse', 'HEAD']).trim() !== c.sha || currentDirtyFingerprint() !== c.fingerprint)
      fail('candidate changed while qualifying');
    scan([sl, cl, stateFile]);
    state.stage = 'QUALIFIED';
    rewriteState(stateFile, state);
    const manifest = {
      schema: 'W3-RUNTIME-MANIFEST-v4',
      git: { sha: c.sha, dirtyFingerprint: c.fingerprint },
      runtime: {
        serverUrl: `http://127.0.0.1:${c.serverPort}`,
        clientUrl: `http://127.0.0.1:${c.clientPort}`,
        healthStatus: health.status,
        readyStatus: ready.status,
        frontendStatus: front.status,
        serverGitSha: hj.gitSha,
        readinessBuildSha: rj.buildSha,
        migrationState: rj.migrations.state,
        sqlMigrationState: rj.sqlMigrations.state,
        clientMarkerVerified: true,
      },
      database: { ...state.database, migrations, migrationChainSha256 },
      fixture: c.fixture ? { ...c.fixture, sqlMarkerVerified: true } : null,
      auth: {
        nodeEnv: 'development',
        secretPersisted: false,
        e2eMode: false,
        enableTestAuthBypass: false,
        enableTestGateway: false,
        enableTestSupport: false,
      },
      runtimeFeatures: {
        v8GlobalEnabled: true,
        v8ShadowModeEnabled: false,
      },
      dotenvIsolation: {
        serverDisabled: true,
        viteDisabled: true,
        ownedGroupPidCount: groupEnvironments.length,
        prohibitedKeysAbsentInOwnedGroupProcesses: true,
        knownProhibitedValuesAbsentFromServedRootAndMarker: true,
        serverOnlyCredentialsAbsentFromViteGroup: true,
      },
      ownership: {
        stateDir: c.stateDir,
        serverPid: server.pid,
        serverPgid: state.server.pgid,
        clientPid: client.pid,
        clientPgid: state.client.pgid,
      },
    };
    writeExclusive(c.manifestPath, manifest);
    scan([sl, cl, stateFile, c.manifestPath]);
    console.log(JSON.stringify(manifest, null, 2));
  } catch (e) {
    if (cleanupArmed)
      try {
        await runCleanup();
      } catch (ce) {
        throw new AggregateError([e, ce], 'runtime start and cleanup both failed');
      }
    if (!interrupted) throw e;
  }
}
function readState(c) {
  const f = path.join(c.stateDir, 'state.json');
  if (!fs.existsSync(f) || fs.lstatSync(f).isSymbolicLink())
    fail('owned state missing or symlinked');
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (s.sha !== c.sha || s.fingerprint !== c.fingerprint) fail('state candidate identity differs');
  if ((s.mode || 'create') !== c.mode) fail('runtime mode differs from owned state');
  if (JSON.stringify(s.database?.configured) !== JSON.stringify(c.db.configured))
    fail('database host/port/user/name differs from owned state');
  if (c.mode === 'adopt-existing') {
    if (s.fixture?.path !== c.fixture?.path || s.fixture?.sha256 !== c.fixture?.sha256)
      fail('fixture manifest identity/hash differs from owned state');
  }
  return s;
}
async function stop(c) {
  const s = readState(c);
  const pre = await bind(c, s);
  if (!pre.exists) {
    await pre.admin.end();
    fail('owned database absent before stop; refusing process signal');
  }
  await pre.admin.end();
  await verifyAdoptedMarker(c);
  await cleanup(c, s);
  const a = new pg.Client({ connectionString: adminUrl(c.db) });
  await a.connect();
  const absent = !(await exists(a, c.db.configured.name));
  await a.end();
  if (c.mode === 'adopt-existing') {
    if (absent) fail('adopted database missing after stop');
    await verifyAdoptedMarker(c);
  }
  console.log(
    JSON.stringify(
      {
        stopped: true,
        ownedProcessGroupsOnly: true,
        processGroupsVerifiedTerminated: s.cleanupProof?.processGroupsVerifiedTerminated === true,
        ...(c.mode === 'create'
          ? { databaseDropped: true, catalogAbsent: absent }
          : { databasePreserved: true, catalogPresentAndPreserved: !absent }),
        portsFree: true,
        portsUntouched: [3940, 3941],
      },
      null,
      2
    )
  );
}
async function status(c) {
  const s = readState(c),
    b = await bind(c, s);
  await b.admin.end();
  if (!b.exists) fail('owned database absent');
  await verifyAdoptedMarker(c);
  for (const n of ['server', 'client'])
    if (
      !s[n]?.identity ||
      identity(s[n].pid) !== s[n].identity ||
      processGroup(s[n].pid) !== s[n].pgid
    )
      fail(`${n} exact PID identity/PGID is not alive`);
  for (const [n, p] of [
    ['server', c.serverPort],
    ['client', c.clientPort],
  ]) {
    const listeners = listenerPids(p);
    if (!listeners.length || listeners.some((pid) => processGroup(pid) !== s[n].pgid))
      fail(`${n} listener is absent or outside owned process group`);
  }
  console.log(
    JSON.stringify(
      { ...s, serverAliveExact: true, clientAliveExact: true, portsListeningInOwnedGroups: true },
      null,
      2
    )
  );
}
const c = validate();
if (!c.probe) {
  if (cmd === 'start') await start(c);
  else if (cmd === 'stop') await stop(c);
  else await status(c);
}
