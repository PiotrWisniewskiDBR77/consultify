#!/usr/bin/env node
/**
 * K3 FAZA 2 — ŻYWE PORÓWNANIE BAZA vs KANDYDAT PRZY FLAGACH WYŁĄCZONYCH.
 *
 * Dwa API stoją na TEJ SAMEJ bazie, oba z NIEUSTAWIONYMI flagami
 * (ENABLE_INITIATIVE_UNIFIED_WRITE / _READ / ENABLE_INITIATIVE_APPROVAL_V2).
 * Skrypt wykonuje ten sam ciąg żądań na obu, normalizuje to, co z definicji
 * musi się różnić (czas, identyfikatory losowe, tokeny), i porównuje
 * status + treść BIT W BIT. Każda różnica to złamany parytet.
 *
 * Mandat: obalić, nie potwierdzić. Brak różnic ogłaszamy dopiero po pomiarze.
 *
 * URUCHOMIENIE (wymaga wolnego dysku — patrz nagłówek raportu K3):
 *   node scripts/dev/parytet-flagi-off.mjs \
 *     --baza http://127.0.0.1:4310 --kandydat http://127.0.0.1:4311 \
 *     --email owner@parytet.test --haslo '<haslo-z-seeda>'
 *
 * Opcjonalnie: --tylko-odczyt (pomija ciąg zapisu).
 */

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const BAZA = arg('baza', 'http://127.0.0.1:4310');
const KANDYDAT = arg('kandydat', 'http://127.0.0.1:4311');
const EMAIL = arg('email', 'owner@parytet.test');
const HASLO = arg('haslo', '');
const TYLKO_ODCZYT = has('tylko-odczyt');

if (!HASLO) {
  console.error('BŁĄD: podaj --haslo (konto OWNER z seeda fazy 2).');
  process.exit(2);
}

/* ------------------------------------------------------------------ */
/* Normalizacja: usuwa to, co RÓŻNI SIĘ Z DEFINICJI, nie z powodu kodu. */
/* ------------------------------------------------------------------ */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g;
/** Pola, których wartość zależy od zegara/losowości, nie od gałęzi kodu. */
const VOLATILE_KEYS = new Set([
  'createdAt', 'created_at', 'updatedAt', 'updated_at', 'exportedAt',
  'timestamp', 'requestId', 'traceId', 'correlationId', 'token',
  'accessToken', 'refreshToken', 'expiresAt', 'iat', 'exp', 'etag',
  'durationMs', 'elapsedMs', 'uptime', 'gitSha', 'buildSha',
]);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = VOLATILE_KEYS.has(key) ? '<ZMIENNE>' : normalize(value[key]);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.replace(UUID, '<UUID>').replace(ISO_DATE, '<CZAS>');
  }
  return value;
}

const stable = (value) => JSON.stringify(normalize(value), null, 1);

/* ------------------------------------------------------------------ */

async function login(base) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: HASLO }),
  });
  const body = await res.json().catch(() => ({}));
  const token = body?.token || body?.accessToken || body?.data?.token;
  if (!res.ok || !token) {
    throw new Error(`login ${base} -> ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  return token;
}

async function call(base, token, method, sciezka, body) {
  const res = await fetch(`${base}${sciezka}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/** Ciąg tylko-odczyt. Bezpieczny do powtarzania na obu stanowiskach. */
const ODCZYT = [
  ['GET', '/api/health'],
  ['GET', '/api/pmo/initiatives'],
  ['GET', '/api/v8/my-work/summary'],
  ['GET', '/api/v8/execution/cases'],
  // Trasy dodane przez kandydata — na BAZIE muszą dać 404, na KANDYDACIE
  // przy fladze OFF muszą dać `{enabled:false}`. Różnica jest OCZEKIWANA
  // i raportowana osobno (sekcja „trasy nowe"), nie jako złamany parytet.
  ['GET', '/api/pmo/my-work/definition-approvals', null, { nowa: true }],
];

async function ciagOdczytu(token4310, token4311) {
  const roznice = [];
  let porownane = 0;

  for (const [method, sciezka, body, meta] of ODCZYT) {
    const [a, b] = await Promise.all([
      call(BAZA, token4310, method, sciezka, body),
      call(KANDYDAT, token4311, method, sciezka, body),
    ]);
    porownane += 1;

    const aStatus = a.status;
    const bStatus = b.status;
    const aBody = stable(a.body);
    const bBody = stable(b.body);

    if (aStatus === bStatus && aBody === bBody) continue;

    roznice.push({
      zadanie: `${method} ${sciezka}`,
      nowaTrasa: Boolean(meta?.nowa),
      baza: { status: aStatus, body: aBody },
      kandydat: { status: bStatus, body: bBody },
    });
  }
  return { porownane, roznice };
}

/** Ciąg z zapisem. Uruchamiaj po zrzucie `pg_dump --data-only` i przywróceniu. */
const ZAPIS = [
  ['POST', '/api/pmo/initiatives', { title: 'K3 parytet', summary: 'ciag zapisu' }],
  // Kolejne kroki (zmiana statusu, zatwierdzenie) używają id z odpowiedzi
  // powyżej — wypełniane w czasie działania przez podstawId().
  ['PATCH', '/api/pmo/initiatives/:id', { title: 'K3 parytet — zmiana' }],
  ['GET', '/api/pmo/initiatives/:id'],
];

function podstawId(sciezka, id) {
  return id ? sciezka.replace(':id', id) : sciezka;
}

async function ciagZapisu(base, token) {
  const slad = [];
  let id = null;
  for (const [method, sciezka, body] of ZAPIS) {
    const wynik = await call(base, token, method, podstawId(sciezka, id), body);
    if (!id) id = wynik.body?.id || wynik.body?.initiative?.id || wynik.body?.data?.id || null;
    slad.push({ zadanie: `${method} ${sciezka}`, status: wynik.status, body: stable(wynik.body) });
  }
  return slad;
}

/* ------------------------------------------------------------------ */

(async () => {
  for (const flag of [
    'ENABLE_INITIATIVE_UNIFIED_WRITE',
    'ENABLE_INITIATIVE_UNIFIED_READ',
    'ENABLE_INITIATIVE_APPROVAL_V2',
  ]) {
    if (process.env[flag] !== undefined) {
      console.error(
        `BŁĄD: ${flag} jest USTAWIONA (${process.env[flag]}). ` +
          'Faza 2 mierzy stan WYŁĄCZONY — uruchom przez `env -u ' + flag + ' ...`.'
      );
      process.exit(2);
    }
  }

  const [tokenBaza, tokenKandydat] = await Promise.all([login(BAZA), login(KANDYDAT)]);

  const odczyt = await ciagOdczytu(tokenBaza, tokenKandydat);
  const realne = odczyt.roznice.filter((r) => !r.nowaTrasa);
  const nowe = odczyt.roznice.filter((r) => r.nowaTrasa);

  console.log('=== K3 FAZA 2 — CIĄG TYLKO-ODCZYT ===');
  console.log(`Porównanych żądań: ${odczyt.porownane}`);
  console.log(`Różnic na trasach WSPÓLNYCH (złamany parytet): ${realne.length}`);
  console.log(`Różnic na trasach NOWYCH kandydata (oczekiwane): ${nowe.length}`);

  for (const r of odczyt.roznice) {
    console.log(`\n--- ${r.zadanie}${r.nowaTrasa ? '  [trasa nowa]' : '  [ZŁAMANY PARYTET]'} ---`);
    console.log(`BAZA      ${r.baza.status}\n${r.baza.body}`);
    console.log(`KANDYDAT  ${r.kandydat.status}\n${r.kandydat.body}`);
  }

  if (!TYLKO_ODCZYT) {
    console.log('\n=== K3 FAZA 2 — CIĄG Z ZAPISEM ===');
    console.log('UWAGA: przed każdym przebiegiem zrzuć i przywróć dane:');
    console.log("  pg_dump --data-only -t initiatives -t decisions -t ie_aggregate_state ...");
    const sladBazy = await ciagZapisu(BAZA, tokenBaza);
    console.log('BAZA:', JSON.stringify(sladBazy, null, 1));
    console.log('Przywróć zrzut, potem uruchom ponownie z --kandydat jako jedynym stanowiskiem.');
  }

  process.exit(realne.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error('BŁĄD WYKONANIA:', err?.message || err);
  process.exit(2);
});
