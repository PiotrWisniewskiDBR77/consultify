/**
 * DOWÓD PARY (obcy NIE może / właściciel MOŻE) dla 6 rodzin tras cross-org.
 * Realny ApiGateway (port PROOF_PORT), realny Postgres, realne JWT z POST /api/auth/register.
 * Każde twierdzenie o zapisie potwierdzane ODCZYTEM NA ZIMNO przez pg.Client (nie przez API).
 */
import { Client } from 'pg';

const BASE = `http://127.0.0.1:${process.env.PROOF_PORT || 5262}`;
const TOK_A = process.env.TOK_A!;
const TOK_B = process.env.TOK_B!;
const ORG_A = process.env.ORG_A_ID!;
const ORG_B = process.env.ORG_B_ID!;
const USER_A = process.env.USER_A_ID!;
const USER_B = process.env.USER_B_ID!;

const pg = new Client({ connectionString: process.env.DATABASE_URL });

type Res = { status: number; body: any };
async function call(method: string, path: string, token: string, body?: any): Promise<Res> {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* plain */ }
  return { status: r.status, body: parsed };
}

const results: { family: string; leg: string; ok: boolean; detail: string }[] = [];
function check(family: string, leg: string, ok: boolean, detail: string) {
  results.push({ family, leg, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${family} | ${leg} | ${detail}`);
}

async function cold(sql: string, params: any[] = []): Promise<any[]> {
  const r = await pg.query(sql, params);
  return r.rows;
}

const stamp = Date.now().toString(36);

async function f1PermissionRequests() {
  const F = 'F1 permission-requests';
  // properly: org A user creates a request
  const created = await call('POST', '/api/permission-requests', TOK_A, {
    requestedPermission: 'admin.super',
    reason: 'dowod cross-org ' + stamp,
  });
  if (created.status !== 201) { check(F, 'setup', false, `POST /api/permission-requests -> ${created.status} ${JSON.stringify(created.body).slice(0,200)}`); return; }
  const id = created.body.id;
  check(F, 'setup', true, `wniosek org A id=${id}`);

  // OBCY
  const atk = await call('PUT', `/api/permission-requests/${id}/approve`, TOK_B);
  const afterAtk = await cold('SELECT status, organization_id FROM permission_requests WHERE id=$1', [id]);
  check(F, 'obcy PUT /:id/approve', atk.status === 404 && afterAtk[0]?.status === 'pending',
    `HTTP=${atk.status} status_po_ataku=${afterAtk[0]?.status}`);

  // OBCY reject
  const atk2 = await call('PUT', `/api/permission-requests/${id}/reject`, TOK_B, { rejectionReason: 'x' });
  const afterAtk2 = await cold('SELECT status FROM permission_requests WHERE id=$1', [id]);
  check(F, 'obcy PUT /:id/reject', atk2.status === 404 && afterAtk2[0]?.status === 'pending',
    `HTTP=${atk2.status} status_po_ataku=${afterAtk2[0]?.status}`);

  // WŁAŚCICIEL
  const own = await call('PUT', `/api/permission-requests/${id}/approve`, TOK_A);
  const afterOwn = await cold('SELECT status, resolved_by FROM permission_requests WHERE id=$1', [id]);
  check(F, 'wlasciciel PUT /:id/approve', own.status === 200 && afterOwn[0]?.status === 'approved',
    `HTTP=${own.status} status_po=${afterOwn[0]?.status} resolved_by=${afterOwn[0]?.resolved_by}`);

  // WŁAŚCICIEL reject na drugim wniosku
  const created2 = await call('POST', '/api/permission-requests', TOK_A, { requestedPermission: 'x2', reason: 'r2' });
  const id2 = created2.body?.id;
  const own2 = await call('PUT', `/api/permission-requests/${id2}/reject`, TOK_A, { rejectionReason: 'nie' });
  const afterOwn2 = await cold('SELECT status FROM permission_requests WHERE id=$1', [id2]);
  check(F, 'wlasciciel PUT /:id/reject', own2.status === 200 && afterOwn2[0]?.status === 'rejected',
    `HTTP=${own2.status} status_po=${afterOwn2[0]?.status}`);
}

async function tableExists(name: string): Promise<boolean> {
  const r = await pg.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [name]
  );
  return r.rowCount === 1;
}

async function f2Videos() {
  const F = 'F2 videos';
  const hasTable = await tableExists('videos');
  if (!hasTable) {
    // Tabela nie powstaje z migracji — kazdy dbGet/dbRun fail-soft'uje (DbPromise fallback:true).
    const c0 = await call('POST', '/api/videos', TOK_A, { title: 'OrgA wideo ' + stamp, url: 'https://example.test/a.mp4' });
    const fakeId = c0.body?.id;
    const atk0 = await call('DELETE', `/api/videos/${fakeId}`, TOK_B);
    const own0 = await call('DELETE', `/api/videos/${fakeId}`, TOK_A);
    const list0 = await call('GET', '/api/videos', TOK_A);
    check(F, 'BRAK TABELI videos', false,
      `tabela videos NIE ISTNIEJE po 882 migracjach; POST HTTP=${c0.status} (id=${fakeId}, nic nie zapisano), ` +
      `obcy DELETE HTTP=${atk0.status}, WLASCICIEL DELETE HTTP=${own0.status}, GET wlasciciela=${JSON.stringify(list0.body).slice(0,80)}`);
    return;
  }
  const c1 = await call('POST', '/api/videos', TOK_A, { title: 'OrgA wideo ' + stamp, url: 'https://example.test/a.mp4' });
  if (c1.status !== 201) { check(F, 'setup', false, `POST /api/videos -> ${c1.status} ${JSON.stringify(c1.body).slice(0,200)}`); return; }
  const id1 = c1.body.id;
  const c2 = await call('POST', '/api/videos', TOK_A, { title: 'OrgA wideo2 ' + stamp, url: 'https://example.test/b.mp4' });
  const id2 = c2.body?.id;
  check(F, 'setup', true, `wideo org A id=${id1}, id2=${id2}`);

  const atk = await call('DELETE', `/api/videos/${id1}`, TOK_B);
  const after = await cold('SELECT id FROM videos WHERE id=$1', [id1]);
  check(F, 'obcy DELETE /:id', atk.status === 404 && after.length === 1,
    `HTTP=${atk.status} wiersz_istnieje=${after.length === 1}`);

  const own = await call('DELETE', `/api/videos/${id1}`, TOK_A);
  const afterOwn = await cold('SELECT id FROM videos WHERE id=$1', [id1]);
  check(F, 'wlasciciel DELETE /:id', own.status === 200 && afterOwn.length === 0,
    `HTTP=${own.status} wiersz_po=${afterOwn.length}`);
}

async function f3Context() {
  const F = 'F3 kontekst AI';
  // Trasa POST /api/context jest ZEPSUTA na schemacie od zera (INSERT wymienia kolumne
  // user_id, ktorej ai_contexts nie ma) i fail-softuje na 201 bez zapisu. Zeby zmierzyc
  // SAMO ZABEZPIECZENIE (a nie martwa sciezke tworzenia), rekord zakladamy wprost w bazie.
  const c1 = await call('POST', '/api/context', TOK_A, { name: 'OrgA kontekst ' + stamp, content: 'TAJNE ORG A', type: 'custom' });
  const rowsAfterPost = await cold('SELECT id FROM ai_contexts WHERE name = $1', ['OrgA kontekst ' + stamp]);
  check(F, 'trasa POST /api/context (kanal tworzenia)', rowsAfterPost.length === 1,
    `HTTP=${c1.status} zapisanych_wierszy=${rowsAfterPost.length} (fail-soft DbPromise maskuje blad kolumny user_id)`);

  const id = `ctx_${stamp}_a`;
  await pg.query(
    `INSERT INTO ai_contexts (id, organization_id, name, type, content, priority, is_active) VALUES ($1,$2,$3,'custom','TAJNE ORG A',0,1)`,
    [id, ORG_A, 'OrgA kontekst ' + stamp]
  );
  check(F, 'setup (wprost w bazie, bo trasa tworzenia martwa)', true, `kontekst org A id=${id}`);

  // TRASA 1: PUT
  const atkPut = await call('PUT', `/api/context/${id}`, TOK_B, { name: 'PWNED BY ORG B', content: 'nadpisane' });
  const afterPut = await cold('SELECT name, content FROM ai_contexts WHERE id=$1', [id]);
  check(F, 'obcy PUT /:id (trasa 1)', atkPut.status === 404 && afterPut[0]?.name?.startsWith('OrgA kontekst'),
    `HTTP=${atkPut.status} name_po_ataku=${afterPut[0]?.name}`);

  // TRASA 2: DELETE
  const atkDel = await call('DELETE', `/api/context/${id}`, TOK_B);
  const afterDel = await cold('SELECT id FROM ai_contexts WHERE id=$1', [id]);
  check(F, 'obcy DELETE /:id (trasa 2)', atkDel.status === 404 && afterDel.length === 1,
    `HTTP=${atkDel.status} wiersz_istnieje=${afterDel.length === 1}`);

  // WŁAŚCICIEL PUT
  const ownPut = await call('PUT', `/api/context/${id}`, TOK_A, { name: 'OrgA zmieniony ' + stamp });
  const afterOwnPut = await cold('SELECT name FROM ai_contexts WHERE id=$1', [id]);
  check(F, 'wlasciciel PUT /:id (trasa 1)', ownPut.status === 200 && afterOwnPut[0]?.name === 'OrgA zmieniony ' + stamp,
    `HTTP=${ownPut.status} name_po=${afterOwnPut[0]?.name}`);

  // WŁAŚCICIEL DELETE
  const ownDel = await call('DELETE', `/api/context/${id}`, TOK_A);
  const afterOwnDel = await cold('SELECT id FROM ai_contexts WHERE id=$1', [id]);
  check(F, 'wlasciciel DELETE /:id (trasa 2)', ownDel.status === 200 && afterOwnDel.length === 0,
    `HTTP=${ownDel.status} wiersz_po=${afterOwnDel.length}`);
}

async function makeProjectA(): Promise<string | null> {
  const r = await call('POST', '/api/projects', TOK_A, { name: 'Projekt OrgA ' + stamp, description: 'dowod' });
  if (r.status === 201 || r.status === 200) {
    return r.body?.id || r.body?.data?.id || r.body?.project?.id || null;
  }
  console.log('  [setup projektu] HTTP=' + r.status + ' ' + JSON.stringify(r.body).slice(0, 300) + ' — biore istniejacy projekt org A');
  const rows = await cold('SELECT id FROM projects WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1', [ORG_A]);
  return rows[0]?.id || null;
}

async function f4ProjectMembers(projectA: string) {
  const F = 'F4 project-members';
  // OBCY: GET
  const atkGet = await call('GET', `/api/project-members/${projectA}`, TOK_B);
  check(F, 'obcy GET /:projectId', atkGet.status === 404, `HTTP=${atkGet.status}`);

  // OBCY: wstrzyknięcie siebie jako ADMIN
  const atkPost = await call('POST', `/api/project-members/${projectA}`, TOK_B, { userId: USER_B, role: 'ADMIN' });
  const injected = await cold('SELECT id FROM project_members WHERE project_id=$1 AND user_id=$2', [projectA, USER_B]);
  check(F, 'obcy POST /:projectId (wstrzykniecie ADMIN)', atkPost.status === 404 && injected.length === 0,
    `HTTP=${atkPost.status} wstrzyknietych_wierszy=${injected.length}`);

  // WŁAŚCICIEL: POST własnego usera
  const ownPost = await call('POST', `/api/project-members/${projectA}`, TOK_A, { userId: USER_A, role: 'MEMBER' });
  const ownRows = await cold('SELECT id, project_role FROM project_members WHERE project_id=$1 AND user_id=$2', [projectA, USER_A]);
  check(F, 'wlasciciel POST /:projectId', (ownPost.status === 201 || ownPost.status === 200) && ownRows.length >= 1,
    `HTTP=${ownPost.status} wierszy=${ownRows.length} ${JSON.stringify(ownPost.body).slice(0,150)}`);

  // WŁAŚCICIEL: GET
  const ownGet = await call('GET', `/api/project-members/${projectA}`, TOK_A);
  check(F, 'wlasciciel GET /:projectId', ownGet.status === 200 && Array.isArray(ownGet.body),
    `HTTP=${ownGet.status} czlonkow=${Array.isArray(ownGet.body) ? ownGet.body.length : 'n/a'}`);

  const memberId = ownRows[0]?.id;
  if (memberId) {
    const atkPut = await call('PUT', `/api/project-members/${projectA}/${memberId}`, TOK_B, { role: 'VIEWER' });
    const afterPut = await cold('SELECT project_role FROM project_members WHERE id=$1', [memberId]);
    check(F, 'obcy PUT /:projectId/:memberId', atkPut.status === 404 && afterPut[0]?.project_role !== 'VIEWER',
      `HTTP=${atkPut.status} rola_po=${afterPut[0]?.project_role}`);

    const atkDel = await call('DELETE', `/api/project-members/${projectA}/${memberId}`, TOK_B);
    const afterDel = await cold('SELECT id FROM project_members WHERE id=$1', [memberId]);
    check(F, 'obcy DELETE /:projectId/:memberId', atkDel.status === 404 && afterDel.length === 1,
      `HTTP=${atkDel.status} wiersz_istnieje=${afterDel.length === 1}`);

    const ownDel = await call('DELETE', `/api/project-members/${projectA}/${memberId}`, TOK_A);
    const afterOwnDel = await cold('SELECT id FROM project_members WHERE id=$1', [memberId]);
    check(F, 'wlasciciel DELETE /:projectId/:memberId', ownDel.status === 200 && afterOwnDel.length === 0,
      `HTTP=${ownDel.status} wiersz_po=${afterOwnDel.length}`);
  } else {
    check(F, 'PUT/DELETE', false, 'brak memberId — nie da się zmierzyć');
  }
}

async function f5Studio() {
  const F = 'F5 studio';
  const c = await call('POST', '/api/studio/documents', TOK_A, {
    name: 'OrgA Secret Canvas ' + stamp, type: 'mindmap', nodes: [{ id: 'n1', data: { label: 'TAJNE' } }], edges: [],
  });
  if (c.status !== 201 && c.status !== 200) { check(F, 'setup', false, `POST -> ${c.status} ${JSON.stringify(c.body).slice(0,300)}`); return; }
  const id = c.body?.id || c.body?.document?.id;
  check(F, 'setup', !!id, `dokument org A id=${id}`);
  if (!id) return;

  const atkGet = await call('GET', `/api/studio/documents/${id}`, TOK_B);
  check(F, 'obcy GET /documents/:id', atkGet.status === 404, `HTTP=${atkGet.status}`);

  const atkPut = await call('PUT', `/api/studio/documents/${id}`, TOK_B, { name: 'PWNED BY ORG B' });
  const afterPut = await cold('SELECT name FROM studio_documents WHERE id=$1', [id]);
  check(F, 'obcy PUT /documents/:id', atkPut.status === 404 && !String(afterPut[0]?.name).includes('PWNED'),
    `HTTP=${atkPut.status} name_po=${afterPut[0]?.name}`);

  // najpierw WLASCICIEL tworzy snapshot, zeby "pusta lista u obcego" nie byla pusta dla wszystkich
  const preSnap = await call('POST', `/api/studio/documents/${id}/snapshots`, TOK_A, { reason: 'baza dowodu' });
  const snapRows = await cold('SELECT id FROM studio_snapshots WHERE document_id=$1', [id]);
  check(F, 'wlasciciel POST /documents/:id/snapshots (baza)', (preSnap.status === 200 || preSnap.status === 201) && snapRows.length >= 1,
    `HTTP=${preSnap.status} snapshotow_w_bazie=${snapRows.length}`);
  const snapshotId = snapRows[0]?.id;

  const ownSnapGet = await call('GET', `/api/studio/documents/${id}/snapshots`, TOK_A);
  const ownSnapCount = Array.isArray(ownSnapGet.body) ? ownSnapGet.body.length : (ownSnapGet.body?.snapshots?.length ?? -1);
  check(F, 'wlasciciel GET /documents/:id/snapshots', ownSnapGet.status === 200 && ownSnapCount >= 1,
    `HTTP=${ownSnapGet.status} elementow=${ownSnapCount}`);

  const atkSnapGet = await call('GET', `/api/studio/documents/${id}/snapshots`, TOK_B);
  const atkSnapCount = Array.isArray(atkSnapGet.body) ? atkSnapGet.body.length : (atkSnapGet.body?.snapshots?.length ?? -1);
  check(F, 'obcy GET /documents/:id/snapshots', atkSnapGet.status === 404 || atkSnapCount === 0,
    `HTTP=${atkSnapGet.status} elementow=${atkSnapCount} (u wlasciciela ${ownSnapCount})`);

  if (snapshotId) {
    const atkRestore = await call('POST', `/api/studio/snapshots/${snapshotId}/restore`, TOK_B, {});
    check(F, 'obcy POST /snapshots/:id/restore', atkRestore.status === 404 || atkRestore.status === 403,
      `HTTP=${atkRestore.status} ${JSON.stringify(atkRestore.body).slice(0,120)}`);
    const ownRestore = await call('POST', `/api/studio/snapshots/${snapshotId}/restore`, TOK_A, {});
    check(F, 'wlasciciel POST /snapshots/:id/restore', ownRestore.status === 200 || ownRestore.status === 201,
      `HTTP=${ownRestore.status} ${JSON.stringify(ownRestore.body).slice(0,120)}`);
  }

  const atkDel = await call('DELETE', `/api/studio/documents/${id}`, TOK_B);
  const afterDel = await cold('SELECT id FROM studio_documents WHERE id=$1', [id]);
  check(F, 'obcy DELETE /documents/:id', atkDel.status === 404 && afterDel.length === 1,
    `HTTP=${atkDel.status} wiersz_istnieje=${afterDel.length === 1}`);

  // WŁAŚCICIEL
  const ownGet = await call('GET', `/api/studio/documents/${id}`, TOK_A);
  check(F, 'wlasciciel GET /documents/:id', ownGet.status === 200, `HTTP=${ownGet.status}`);
  const ownPut = await call('PUT', `/api/studio/documents/${id}`, TOK_A, { name: 'OrgA zmieniony ' + stamp });
  const afterOwnPut = await cold('SELECT name FROM studio_documents WHERE id=$1', [id]);
  check(F, 'wlasciciel PUT /documents/:id', ownPut.status === 200 && String(afterOwnPut[0]?.name).includes('zmieniony'),
    `HTTP=${ownPut.status} name_po=${afterOwnPut[0]?.name}`);
  const ownDel = await call('DELETE', `/api/studio/documents/${id}`, TOK_A);
  const afterOwnDel = await cold('SELECT id FROM studio_documents WHERE id=$1', [id]);
  check(F, 'wlasciciel DELETE /documents/:id', ownDel.status === 200 && afterOwnDel.length === 0,
    `HTTP=${ownDel.status} wiersz_po=${afterOwnDel.length}`);
}

async function f6Escalations(projectA: string) {
  const F = 'F6 escalations';
  // decyzja org A wymagająca eskalacji
  const decId = `dec_${stamp}_a`;
  await pg.query(
    `INSERT INTO decisions (id, organization_id, project_id, title, description, status, escalation_level, deadline, priority, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'pending','NORMAL', NOW() - INTERVAL '30 days', 'high', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days')`,
    [decId, ORG_A, projectA, 'OrgA Confidential Board Decision ' + stamp, 'tajne']
  );
  check(F, 'setup', true, `decyzja org A id=${decId} projekt=${projectA}`);

  const atkGet = await call('GET', `/api/notifications/escalations/${projectA}`, TOK_B);
  const leaked = JSON.stringify(atkGet.body).includes('OrgA Confidential');
  check(F, 'obcy GET /escalations/:projectId', !leaked,
    `HTTP=${atkGet.status} wyciek_tytulu=${leaked} body=${JSON.stringify(atkGet.body).slice(0,160)}`);

  const beforeRun = await cold('SELECT escalation_level, status, updated_at FROM decisions WHERE id=$1', [decId]);
  const atkRun = await call('POST', `/api/notifications/escalations/${projectA}/run`, TOK_B, {});
  const afterRun = await cold('SELECT escalation_level, status, updated_at FROM decisions WHERE id=$1', [decId]);
  const unchanged = String(beforeRun[0]?.escalation_level) === String(afterRun[0]?.escalation_level)
    && String(beforeRun[0]?.updated_at) === String(afterRun[0]?.updated_at);
  check(F, 'obcy POST /escalations/:projectId/run', unchanged,
    `HTTP=${atkRun.status} przed=${beforeRun[0]?.escalation_level}/${beforeRun[0]?.updated_at} po=${afterRun[0]?.escalation_level}/${afterRun[0]?.updated_at} body=${JSON.stringify(atkRun.body).slice(0,120)}`);

  // WŁAŚCICIEL
  const ownGet = await call('GET', `/api/notifications/escalations/${projectA}`, TOK_A);
  const sees = JSON.stringify(ownGet.body).includes('OrgA Confidential');
  check(F, 'wlasciciel GET /escalations/:projectId', ownGet.status === 200 && sees,
    `HTTP=${ownGet.status} widzi_swoja_decyzje=${sees} body=${JSON.stringify(ownGet.body).slice(0,200)}`);

  const ownRun = await call('POST', `/api/notifications/escalations/${projectA}/run`, TOK_A, {});
  const afterOwnRun = await cold('SELECT escalation_level, updated_at FROM decisions WHERE id=$1', [decId]);
  const changed = String(afterOwnRun[0]?.escalation_level) !== String(beforeRun[0]?.escalation_level)
    || String(afterOwnRun[0]?.updated_at) !== String(beforeRun[0]?.updated_at);
  check(F, 'wlasciciel POST /escalations/:projectId/run', ownRun.status === 200 && changed,
    `HTTP=${ownRun.status} body=${JSON.stringify(ownRun.body).slice(0,150)} poziom_po=${afterOwnRun[0]?.escalation_level}`);
}

async function main() {
  await pg.connect();
  const only = process.env.ONLY_FAMILY || '';
  const projectA = process.env.PROJECT_A || (await makeProjectA());
  console.log('[PROOF] projectA=' + projectA);
  if (!only || only === 'f1') await f1PermissionRequests();
  if (!only || only === 'f2') await f2Videos();
  if (!only || only === 'f3') await f3Context();
  if (projectA) {
    if (!only || only === 'f4') await f4ProjectMembers(projectA);
    if (!only || only === 'f6') await f6Escalations(projectA);
  } else {
    check('F4/F6', 'setup', false, 'nie udalo sie utworzyc projektu org A');
  }
  if (!only || only === 'f5') await f5Studio();

  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n[PROOF] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.log('[PROOF] NIEZALICZONE:');
    failed.forEach((f) => console.log(`  - ${f.family} | ${f.leg} | ${f.detail}`));
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('[PROOF] FATAL', e); process.exit(2); });
