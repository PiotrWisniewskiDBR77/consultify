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
  runtimeSecrets = [];
const fail = (m) => {
    throw new Error(`[W3 runtime] BLOCKED: ${m}`);
  },
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (a) => {
  const r = spawnSync('git', a, { cwd: root, encoding: 'utf8' });
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
function parseDb(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('WAVE3_RUNTIME_DATABASE_URL is invalid');
  }
  const name = url.pathname.slice(1),
    port = Number(url.port || 5432);
  if (!localHosts.has(url.hostname) || !/^consultify_w3_runtime_[a-z0-9_]+$/.test(name))
    fail('runtime DB must be local and named consultify_w3_runtime_*');
  if (!url.username || !Number.isInteger(port)) fail('runtime DB user/port required');
  return {
    url,
    configured: { host: url.hostname, port, user: decodeURIComponent(url.username), name },
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
  const db = parseDb(process.env.WAVE3_RUNTIME_DATABASE_URL || ''),
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
    if (b.exists) await b.admin.query(`drop database "${c.db.configured.name}" with (force)`);
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
      database: { configured: c.db.configured },
      server: null,
      client: null,
      stage: 'ALLOCATING_DB',
    };
  let created = false,
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
      .then(() => (created ? runCleanup() : undefined))
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
        if (await exists(admin, c.db.configured.name)) fail('runtime database already exists');
        await admin.query(`create database "${c.db.configured.name}"`);
        created = true;
        const delay = Number(process.env.WAVE3_RUNTIME_TEST_DB_STAGE_DELAY_MS || 0);
        if (delay > 0) await sleep(delay);
        if (process.env.WAVE3_RUNTIME_TEST_DB_STAGE_FAIL === '1')
          fail('injected database ownership stage failure');
      } finally {
        await admin.end();
      }
      state.stage = 'DB_CREATED';
      writeExclusive(stateFile, state);
    })();
    await activeOwnershipStage;
    activeOwnershipStage = Promise.resolve();
    if (stopForwardProgress()) return;
    if (process.env.WAVE3_RUNTIME_FAIL_AT === 'after-db') fail('injected after-db failure');
    const migration = spawnSync('npm', ['run', 'db:migrate:strict'], {
      cwd: root,
      env: childEnv({ NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: c.db.url.toString() }),
      encoding: 'utf8',
    });
    if (stopForwardProgress()) return;
    if (migration.status !== 0) fail(`migration failed: ${migration.stderr || migration.stdout}`);
    if (process.env.WAVE3_RUNTIME_FAIL_AT === 'migration') fail('injected migration failure');
    const db = new pg.Client({ connectionString: c.db.url.toString() });
    await db.connect();
    const migrations = Number(
        (await db.query(`select count(*)::int n from schema_migrations where status='success'`))
          .rows[0].n
      ),
      actual = (
        await db.query(
          `select current_database() name,current_user "user",inet_server_addr()::text host,inet_server_port() port`
        )
      ).rows[0];
    await db.end();
    if (stopForwardProgress()) return;
    if (actual.name !== c.db.configured.name || actual.user !== c.db.configured.user)
      fail('live DB identity mismatch');
    state.database.actual = actual;
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
        DISABLE_SCHEDULER: 'true',
        DISABLE_AI_PROVIDER_SENTINEL: 'true',
        DISABLE_AI_HEALTH_MONITOR: 'true',
        DISABLE_STARTUP_HEALTH_MONITOR: 'true',
        SKIP_STARTUP_VALIDATOR: 'true',
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
      database: { ...state.database, migrations },
      auth: {
        nodeEnv: 'development',
        secretPersisted: false,
        e2eMode: false,
        enableTestAuthBypass: false,
        enableTestGateway: false,
        enableTestSupport: false,
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
    if (created)
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
  if (JSON.stringify(s.database?.configured) !== JSON.stringify(c.db.configured))
    fail('database host/port/user/name differs from owned state');
  return s;
}
async function stop(c) {
  const s = readState(c);
  const pre = await bind(c, s);
  await pre.admin.end();
  await cleanup(c, s);
  const a = new pg.Client({ connectionString: adminUrl(c.db) });
  await a.connect();
  const absent = !(await exists(a, c.db.configured.name));
  await a.end();
  console.log(
    JSON.stringify(
      {
        stopped: true,
        ownedProcessGroupsOnly: true,
        processGroupsVerifiedTerminated: s.cleanupProof?.processGroupsVerifiedTerminated === true,
        databaseDropped: true,
        catalogAbsent: absent,
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
