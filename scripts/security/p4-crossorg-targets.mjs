/**
 * P4 BEZPIECZENSTWO — Etap B, przygotowanie celow dla macierzy cross-org.
 *
 * Sklada plik targets.json:
 *  - victim: realne zasoby organizacji A (czytane z ZYWEJ bazy, nie z kodu),
 *  - attackerOwn: zasoby tego samego typu nalezace do atakujacego, tworzone
 *    przez API — sluza za kontrole bazowa, ktora odroznia "404 bo izolacja"
 *    od "404 bo trasy nie ma".
 *
 * Zasoby atakujacego sa kasowane przez p4-crossorg-cleanup.mjs.
 */
import fs from 'node:fs';
import pg from 'pg';

const BASE = process.env.P4_BASE || 'http://127.0.0.1:3107';
const EMAIL = process.env.P4_ATTACKER_EMAIL;
const PASSWORD = process.env.P4_ATTACKER_PASSWORD;
const VICTIM_ORG = process.env.P4_VICTIM_ORG;
const OUT = process.env.P4_TARGETS_OUT || 'targets.json';

const env = Object.fromEntries(
  fs
    .readFileSync(process.env.P4_ENV_FILE || '.env.staging.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

let csrf = null;
let jwt = null;

async function call(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  if (csrf) {
    headers.cookie = `csrf_token=${csrf}`;
    headers['x-csrf-token'] = csrf;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* nie-JSON */
  }
  return { status: res.status, json, text };
}

const ROUTES = {
  project: ['/api/projects/:id'],
  initiative: ['/api/initiatives/:id'],
  task: ['/api/tasks/:id'],
  decision: ['/api/decisions/:id'],
  user: ['/api/users/:id'],
  organization: ['/api/organizations/:id'],
};

async function main() {
  csrf = (await (await fetch(BASE + '/api/csrf-token')).json()).token;
  const login = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  jwt = login.json?.token || login.json?.data?.token;
  if (!jwt) throw new Error('brak JWT: ' + login.text.slice(0, 200));

  const c = new pg.Client({ connectionString: env.DATABASE_PUBLIC_URL });
  await c.connect();

  const q = async (sql, params) => (await c.query(sql, params)).rows;
  const victimResources = [];
  const push = (type, id) => {
    if (id) victimResources.push({ type, id, marker: id, routes: ROUTES[type] });
  };

  push('organization', VICTIM_ORG);
  push('project', (await q('select id from projects where organization_id=$1 limit 1', [VICTIM_ORG]))[0]?.id);
  push('initiative', (await q('select id from initiatives where organization_id=$1 limit 1', [VICTIM_ORG]))[0]?.id);
  push('task', (await q('select id from tasks where organization_id=$1 limit 1', [VICTIM_ORG]))[0]?.id);
  push('decision', (await q('select id from decisions where organization_id=$1 limit 1', [VICTIM_ORG]))[0]?.id);
  push('user', (await q('select id from users where organization_id=$1 limit 1', [VICTIM_ORG]))[0]?.id);

  // Zasoby wlasne atakujacego (kontrola bazowa).
  const me = await call('GET', '/api/auth/me');
  const myUserId = me.json?.user?.id || me.json?.id || me.json?.data?.id;
  const myOrgId = me.json?.user?.organizationId || me.json?.organizationId || me.json?.data?.organizationId;

  const attackerOwn = [];
  if (myOrgId) attackerOwn.push({ type: 'organization', id: myOrgId, marker: myOrgId });
  if (myUserId) attackerOwn.push({ type: 'user', id: myUserId, marker: myUserId });

  const stamp = Date.now();
  const proj = await call('POST', '/api/projects', {
    name: `P4 sonda projekt ${stamp}`,
    description: 'zasob sondy P4 — do usuniecia',
  });
  const projId = proj.json?.id || proj.json?.data?.id;
  if (projId) attackerOwn.push({ type: 'project', id: projId, marker: projId });

  const init = await call('POST', '/api/initiatives', {
    title: `P4 sonda inicjatywa ${stamp}`,
    description: 'zasob sondy P4 — do usuniecia',
    projectId: projId,
  });
  const initId = init.json?.id || init.json?.data?.id;
  if (initId) attackerOwn.push({ type: 'initiative', id: initId, marker: initId });

  const task = await call('POST', '/api/tasks', {
    title: `P4 sonda zadanie ${stamp}`,
    status: 'todo',
    priority: 'low',
  });
  const taskId = task.json?.id || task.json?.data?.id;
  if (taskId) attackerOwn.push({ type: 'task', id: taskId, marker: taskId });

  const dec = await call('POST', '/api/decisions', {
    title: `P4 sonda decyzja ${stamp}`,
    description: 'zasob sondy P4 — do usuniecia',
    projectId: projId,
  });
  const decId = dec.json?.id || dec.json?.data?.id;
  if (decId) attackerOwn.push({ type: 'decision', id: decId, marker: decId });

  await c.end();

  const payload = {
    generatedAt: new Date().toISOString(),
    victim: { org: VICTIM_ORG, resources: victimResources },
    attackerOwn,
    attackerOrg: myOrgId,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.error(
    `[p4] cele: ofiara=${victimResources.length} zasobow, wlasnych=${attackerOwn.length} ` +
      `(projekt=${proj.status} inicjatywa=${init.status} zadanie=${task.status} decyzja=${dec.status})`
  );
  for (const o of attackerOwn) console.error(`   wlasny ${o.type}: ${o.id}`);
  for (const v of victimResources) console.error(`   ofiara ${v.type}: ${v.id}`);
}

main().catch((e) => {
  console.error('[p4] blad przygotowania celow:', e.message);
  process.exit(1);
});
