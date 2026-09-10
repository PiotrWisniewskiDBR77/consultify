import jwt from 'jsonwebtoken';
const [,, port, orgId, userId, initiativeId, label] = process.argv;
const secret = process.env.JWT_SECRET;
const token = jwt.sign({ id: userId, userId, email: `${userId}@probe.invalid`, organizationId: orgId, organization_id: orgId, role: 'OWNER' }, secret, { algorithm: 'HS256', expiresIn: '20m' });
const base = `http://127.0.0.1:${port}`;
const routes = [
  ['1 lista (rejestr)', `/api/initiatives`],
  ['2 karta', `/api/initiatives/${initiativeId}`],
  ['3 KPI', `/api/initiatives/${initiativeId}/kpis`],
  ['4 kokpit Realizacji', `/api/v8/execution-control/capacity/timeline?initiativeId=${initiativeId}`],
  ['5 Moja Praca', `/api/my-work/executive-analytics`],
  ['6 Wyniki', `/api/v8/results/dashboard?initiativeId=${initiativeId}`],
  ['7 raporty', `/api/report-builder/backlinks/initiative/${initiativeId}`],
];
const out = [];
for (const [surface, route] of routes) {
  const t0 = Date.now();
  let status = 0, body = '', err = null;
  try {
    const r = await fetch(base + route, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    status = r.status; body = await r.text();
  } catch (e) { err = String(e?.message || e); }
  const containsId = body.includes(initiativeId);
  const notFoundCode = /INITIATIVE_NOT_FOUND/.test(body);
  out.push({ surface, route, status, containsId, notFoundCode, ms: Date.now()-t0,
    n_items: (()=>{ try { const j=JSON.parse(body); const a=j?.data?.items||j?.items||j?.data||j; return Array.isArray(a)?a.length:null; } catch { return null; } })(),
    snippet: err ? `ERR ${err}` : body.slice(0, 160) });
}
console.log(JSON.stringify({ label, port, orgId, initiativeId, unified_flag_of_process: 'patrz port', matrix: out }, null, 1));
