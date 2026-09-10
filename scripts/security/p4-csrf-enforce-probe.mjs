/**
 * P4 BEZPIECZENSTWO — Etap A: pelny przeplyw zapisu przy CSRF_MODE=enforce.
 *
 * Nie liczy rekordow — PRZECHODZI przeplyw: loguje sie, pobiera token,
 * tworzy obiekty i sprzata po sobie. Kazda trasa jest strzelana DWA razy:
 *   1) POZYTYW  — z naglowkiem x-csrf-token i cookie csrf_token: zapis MUSI przejsc
 *   2) NEGATYW  — z cookie, ale BEZ naglowka: MUSI dostac 403 CSRF_MISSING
 * Negatyw jest dowodem, ze sonda w ogole cokolwiek mierzy. Bez niego
 * "wszystko przeszlo" znaczyloby tylko tyle, ze enforce nie dziala.
 *
 * PULAPKA (isBearerOnlyRequest, csrf.middleware.ts): zadanie z naglowkiem
 * Authorization i BEZ cookie csrf_token omija ochrone calkowicie. Dlatego
 * negatyw MUSI wysylac cookie — inaczej mierzylby bypass, nie ochrone.
 * Przegladarka zawsze ma cookie (csrfTokenMiddleware ustawia je, gdy
 * CSRF_MODE != off), wiec ten bypass nie dotyczy ruchu z aplikacji.
 *
 * Uruchomienie:
 *   P4_BASE=http://127.0.0.1:3107 P4_EMAIL=... P4_PASSWORD=... \
 *     node scripts/security/p4-csrf-enforce-probe.mjs
 */

const BASE = process.env.P4_BASE || 'http://127.0.0.1:3107';
const EMAIL = process.env.P4_EMAIL;
const PASSWORD = process.env.P4_PASSWORD;
const OUT = process.env.P4_OUT || '';

if (!EMAIL || !PASSWORD) {
  console.error('[p4] brak P4_EMAIL / P4_PASSWORD');
  process.exit(1);
}

let csrfToken = null;
let jwt = null;

async function call(method, path, { body, withCsrfHeader = true, withCookie = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  if (withCookie && csrfToken) headers.cookie = `csrf_token=${csrfToken}`;
  if (withCsrfHeader && csrfToken) headers['x-csrf-token'] = csrfToken;
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
    /* nie-JSON: zostaje text */
  }
  return { status: res.status, json, text: text.slice(0, 400) };
}

function isCsrfBlock(r) {
  return r.status === 403 && r.json && (r.json.code === 'CSRF_MISSING' || r.json.code === 'CSRF_INVALID');
}

/** Trasa nie istnieje (404 przed autoryzacja) vs. odrzucona swiadomie. */
function looksLikeMissingRoute(r) {
  if (r.status !== 404) return false;
  const body = (r.text || '').toLowerCase();
  return body.includes('cannot ') || body.includes('not found') && !r.json?.code;
}

const results = [];

async function probe(name, method, path, body, cleanup) {
  const positive = await call(method, path, { body });
  const negative = await call(method, path, { body, withCsrfHeader: false });

  const row = {
    name,
    route: `${method} ${path}`,
    positive: { status: positive.status, csrfBlocked: isCsrfBlock(positive), body: positive.text.slice(0, 160) },
    negative: { status: negative.status, csrfBlocked: isCsrfBlock(negative) },
    routeMissing: looksLikeMissingRoute(positive),
  };

  // Werdykt per trasa:
  //  - PASS  : zapis z tokenem przeszedl (nie zablokowany przez CSRF) ORAZ bez tokenu zostal zablokowany
  //  - FAIL  : zapis z tokenem zostal zablokowany przez CSRF -> enforce zabije te trase
  //  - SLEPA : enforce nie zablokowal nawet bez tokenu -> sonda nic tu nie mierzy
  //  - N/A   : trasa nie istnieje
  if (row.routeMissing) row.verdict = 'N/A (trasa nie istnieje)';
  else if (row.positive.csrfBlocked) row.verdict = 'FAIL (enforce blokuje prawidlowy zapis)';
  else if (!row.negative.csrfBlocked) row.verdict = 'SLEPA (enforce nie blokuje braku tokenu)';
  else row.verdict = 'PASS';

  results.push(row);
  console.error(`  ${row.verdict.padEnd(38)} ${row.route}  poz=${positive.status} neg=${negative.status}`);

  if (cleanup && !row.positive.csrfBlocked) {
    const created = positive.json?.data?.id || positive.json?.id || positive.json?.data?.data?.id;
    if (created) {
      const del = await call('DELETE', cleanup(created));
      row.cleanup = { route: cleanup(created), status: del.status };
      console.error(`     sprzatanie: DELETE ${cleanup(created)} -> ${del.status}`);
    }
  }
  return positive;
}

async function main() {
  // 1) token CSRF (trasa zwolniona z ochrony — inaczej nie dalo by sie zaczac)
  const tok = await fetch(BASE + '/api/csrf-token');
  const tokJson = await tok.json();
  csrfToken = tokJson.token;
  console.error(`[p4] csrf-token: ${tok.status}, dlugosc=${String(csrfToken || '').length}`);

  // 2) logowanie (trasa zwolniona: isExemptPath)
  const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  jwt = login.json?.token || login.json?.data?.token || login.json?.accessToken || login.json?.data?.accessToken;
  console.error(`[p4] login: ${login.status}, jwt=${jwt ? 'jest' : 'BRAK'}`);
  if (!jwt) {
    console.error('[p4] STOP: brak JWT — dalsze pomiary bylyby bezwartosciowe. Odpowiedz:', login.text);
    process.exit(3);
  }

  const stamp = Date.now();
  console.error('[p4] przeplyw zapisu (enforce):');

  // projectId jest wymagany (INITIATIVE_PROJECT_REQUIRED) — bierzemy pierwszy
  // projekt WLASNEJ organizacji, inaczej 400 z walidacji udawalby wynik CSRF.
  const projects = await call('GET', '/api/projects');
  const projectList = projects.json?.data || projects.json?.projects || projects.json || [];
  const projectId = Array.isArray(projectList) ? projectList[0]?.id : projectList?.data?.[0]?.id;
  console.error(`[p4] projectId do zapisow: ${projectId || 'BRAK'} (GET /api/projects -> ${projects.status})`);

  await probe('inicjatywa', 'POST', '/api/initiatives', {
    title: `P4 sonda inicjatywa ${stamp}`,
    description: 'rekord sondy bezpieczenstwa P4 — do usuniecia',
    status: 'draft',
    projectId,
  }, (id) => `/api/initiatives/${id}`);

  await probe('zadanie', 'POST', '/api/tasks', {
    title: `P4 sonda zadanie ${stamp}`,
    description: 'rekord sondy bezpieczenstwa P4 — do usuniecia',
    status: 'todo',
    priority: 'low',
  }, (id) => `/api/tasks/${id}`);

  await probe('decyzja', 'POST', '/api/decisions', {
    title: `P4 sonda decyzja ${stamp}`,
    description: 'rekord sondy bezpieczenstwa P4 — do usuniecia',
    projectId,
    decision: 'sonda',
  }, (id) => `/api/decisions/${id}`);

  for (const p of ['/api/tool-assets', '/api/knowledge/candidates', '/api/materials']) {
    const r = await probe('material', 'POST', p, {
      title: `P4 sonda material ${stamp}`,
      content: 'rekord sondy bezpieczenstwa P4 — do usuniecia',
      type: 'note',
    }, (id) => `${p}/${id}`);
    if (!looksLikeMissingRoute(r)) break;
  }

  // Trasa, ktora na stagingu w trybie report generowala 100% narusze CSRF.
  await probe('web-vitals (sendBeacon)', 'POST', '/api/analytics/web-vitals', { name: 'p4', value: 1 });

  // 3) preferencje uzytkownika — zapis, ktory realnie leci z aplikacji (PUT).
  await probe('preferencje', 'PUT', '/api/preferences', { theme: 'light' });

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    csrfMode: 'enforce',
    results,
    counts: results.reduce((a, r) => ((a[r.verdict.split(' ')[0]] = (a[r.verdict.split(' ')[0]] || 0) + 1), a), {}),
  };
  console.error('[p4] podsumowanie:', JSON.stringify(summary.counts));
  const payload = JSON.stringify(summary, null, 2);
  if (OUT) {
    const fs = await import('node:fs');
    fs.writeFileSync(OUT, payload);
    console.error('[p4] zapisano ' + OUT);
  } else {
    console.log(payload);
  }
}

main().catch((e) => {
  console.error('[p4] blad sondy:', e);
  process.exit(1);
});
