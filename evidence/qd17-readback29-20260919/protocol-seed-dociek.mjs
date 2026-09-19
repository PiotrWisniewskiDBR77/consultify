// QD17 — dociek: payload protokołu (bloki decisions/actions + etykiety SOURCE)
// oraz seria cykliczna z seeda (D-64/D-22). Zero zapisów.
import fs from 'node:fs';
const BASE = 'https://staging.consultify.ai';
function creds(rel) {
  const d = fs.readFileSync(process.env.HOME + rel, 'utf8');
  const email = (d.match(/E-?mail:\s*`?([^\s`]+@[^\s`]+)`?/i) || [])[1];
  const pass = process.env.CTO_TEST_PASSWORD || (d.match(/Has[łl]o[^:\n]*:\s*`([^`]+)`/i) || [])[1];
  return { email, pass };
}
const { email, pass } = creds('/Developer/cto-codex/irina-20260914/DOSTEP.md');
const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
const T = (await lr.json()).token;
const H = { authorization: 'Bearer ' + T };
const get = async (u) => { const r = await fetch(BASE + u, { headers: H }); return { status: r.status, j: await r.json().catch(() => null) }; };

const MID = 'c0f1e001-7a11-4f01-9c01-0f0a1b2c3e01';
const p = await get(`/api/meeting/${MID}/protocol`);
const proto = p.j?.protocol ?? p.j;
console.log('PROTOCOL HTTP', p.status);
console.log('klucze protocol:', proto && typeof proto === 'object' ? Object.keys(proto).join(',') : typeof proto);
console.log('bloki:', JSON.stringify(proto, null, 1).slice(0, 1500));

const ml = await get('/api/meeting');
const rows = Array.isArray(ml.j) ? ml.j : (ml.j?.data || ml.j?.meetings || []);
console.log('\nMEETINGS HTTP', ml.status, 'n=', rows.length);
for (const m of rows) {
  console.log('-', m.id, '|', (m.title || m.name || '').slice(0, 44), '| recurrenceRule=', JSON.stringify(m.recurrenceRule ?? m.recurrence_rule ?? null), '| seriesId=', JSON.stringify(m.seriesId ?? m.series_id ?? m.recurrenceSeriesId ?? null), '| status=', m.status ?? m.lifecycle);
}
