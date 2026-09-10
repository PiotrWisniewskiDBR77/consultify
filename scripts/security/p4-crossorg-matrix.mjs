/**
 * P4 BEZPIECZENSTWO — Etap B: macierz izolacji miedzy organizacjami.
 *
 * Pyta: czy konto organizacji B widzi zasob organizacji A?
 *
 * DWIE PULAPKI, KTORE JUZ RAZ ZAFALSZOWALY TEN POMIAR W TYM PROJEKCIE:
 *
 * 1) "404 bo izolacja" vs "404 bo trasy nie ma". Poprzedni pomiar wzial 22
 *    nieistniejace trasy za defekty produktu. Tutaj kazda trasa jest najpierw
 *    strzelana WLASNYM zasobem atakujacego (kontrola bazowa): jesli wlasny
 *    zasob tez daje 404, trasa nie istnieje (N/A) i nie liczy sie ani jako
 *    izolacja, ani jako wyciek. Dopiero gdy wlasny zasob daje 200, a cudzy
 *    403/404 — to jest zmierzona izolacja.
 *
 * 2) "0 wyciekow" bez dowodu, ze pomiar umie wyciek wykryc. Dlatego skrypt
 *    ma TRYB KANARKA (P4_CANARY=1): atakuje zasoby organizacji A kontem
 *    organizacji A. Kazda dzialajaca trasa MUSI wtedy zostac zaklasyfikowana
 *    jako WYCIEK. Zero wykryc w trybie kanarka = pomiar jest slepy i jego
 *    wynik w trybie normalnym jest bezwartosciowy.
 *
 * Mierzone sa TYLKO odczyty (GET). Mutacji cross-org (PUT/DELETE na cudzym
 * zasobie) swiadomie NIE strzelamy na wspoldzielonej bazie staging — udany
 * atak zniszczylby cudze dane. To jest zadeklarowana luka pomiaru, nie PASS.
 */

const BASE = process.env.P4_BASE || 'http://127.0.0.1:3107';
const OUT = process.env.P4_OUT || '';
const CANARY = process.env.P4_CANARY === '1';

const ATTACKER_EMAIL = process.env.P4_ATTACKER_EMAIL;
const ATTACKER_PASSWORD = process.env.P4_ATTACKER_PASSWORD;

let csrfToken = null;
let jwt = null;

async function call(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  if (csrfToken) {
    headers.cookie = `csrf_token=${csrfToken}`;
    headers['x-csrf-token'] = csrfToken;
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

/** Czy odpowiedz faktycznie NIESIE dany zasob (a nie pusta koperta sukcesu)? */
function carriesResource(r, marker) {
  if (r.status !== 200) return false;
  if (!marker) return false;
  return (r.text || '').includes(marker);
}

async function login(email, password) {
  const tok = await fetch(BASE + '/api/csrf-token');
  csrfToken = (await tok.json()).token;
  jwt = null;
  const r = await call('POST', '/api/auth/login', { email, password });
  const t = r.json?.token || r.json?.data?.token || r.json?.accessToken || r.json?.data?.accessToken;
  if (!t) throw new Error(`logowanie ${email} nieudane: ${r.status} ${r.text.slice(0, 200)}`);
  jwt = t;
  return r;
}

async function main() {
  const fs = await import('node:fs');
  const targets = JSON.parse(fs.readFileSync(process.env.P4_TARGETS, 'utf8'));
  // targets: { victim: {org, resources:[{type, id, marker, routes:[...]}]},
  //            attackerOwn: [{type, id, marker, routes:[...]}] }

  await login(ATTACKER_EMAIL, ATTACKER_PASSWORD);
  console.error(`[p4] atakujacy: ${ATTACKER_EMAIL}${CANARY ? '  *** TRYB KANARKA ***' : ''}`);

  const rows = [];
  for (const res of targets.victim.resources) {
    for (const routeTpl of res.routes) {
      const victimPath = routeTpl.replace(':id', res.id);

      // Kontrola bazowa: ta sama trasa na WLASNYM zasobie atakujacego.
      // Bez niej 404 na cudzym zasobie jest nieodroznialne od braku trasy.
      const own = targets.attackerOwn.find((o) => o.type === res.type);
      let baseline = null;
      if (own) {
        const r = await call('GET', routeTpl.replace(':id', own.id));
        baseline = { status: r.status, carries: carriesResource(r, own.marker) };
      }

      const attack = await call('GET', victimPath);
      const leaked = carriesResource(attack, res.marker);

      let verdict;
      if (leaked) verdict = 'WYCIEK';
      else if (baseline && baseline.status === 404 && !baseline.carries) verdict = 'N/A (trasa nie istnieje)';
      else if (baseline && !baseline.carries) verdict = 'N/A (trasa nie oddaje wlasnego zasobu)';
      else if (attack.status === 403 || attack.status === 404) verdict = 'IZOLACJA';
      else if (attack.status === 200) verdict = 'IZOLACJA (200 bez danych ofiary)';
      else verdict = `NIEROZSTRZYGNIETE (${attack.status})`;

      rows.push({
        type: res.type,
        route: `GET ${routeTpl}`,
        victimId: res.id,
        victimOrg: targets.victim.org,
        baseline,
        attack: { status: attack.status, bodyHead: attack.text.slice(0, 140) },
        verdict,
      });
      console.error(`  ${verdict.padEnd(38)} GET ${routeTpl}  wlasny=${baseline?.status ?? '-'}/${baseline?.carries ? 'dane' : 'brak'}  cudzy=${attack.status}`);
    }
  }

  const leaks = rows.filter((r) => r.verdict === 'WYCIEK');
  const measured = rows.filter((r) => r.verdict.startsWith('IZOLACJA') || r.verdict === 'WYCIEK');
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: CANARY ? 'kanarek (atakujacy = wlasciciel; kazda dzialajaca trasa MUSI wyjsc jako WYCIEK)' : 'cross-org',
    attacker: ATTACKER_EMAIL,
    victimOrg: targets.victim.org,
    routesProbed: rows.length,
    routesMeasured: measured.length,
    leaks: leaks.length,
    leakList: leaks.map((l) => ({ route: l.route, victimId: l.victimId, evidence: l.attack.bodyHead })),
    rows,
  };

  console.error(
    `[p4] strzelonych=${rows.length} zmierzonych=${measured.length} wyciekow=${leaks.length}`
  );
  if (CANARY && leaks.length === 0) {
    console.error('[p4] BEZPIECZNIK: tryb kanarka nie wykryl ANI JEDNEGO wycieku — pomiar jest slepy.');
    process.exitCode = 4;
  }

  const payload = JSON.stringify(summary, null, 2);
  if (OUT) {
    fs.writeFileSync(OUT, payload);
    console.error('[p4] zapisano ' + OUT);
  } else {
    console.log(payload);
  }
}

main().catch((e) => {
  console.error('[p4] blad macierzy:', e.message);
  process.exit(1);
});
