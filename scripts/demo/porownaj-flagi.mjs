#!/usr/bin/env node
// =============================================================================
// scripts/demo/porownaj-flagi.mjs — porównanie zmiennych demo ze stagingiem.
//
// WEJŚCIE: dwa pliki z `railway variables --environment <env> --service consultify --json`.
//   node scripts/demo/porownaj-flagi.mjs <staging.json> <demo.json>
//
// CO SPRAWDZA
//   1. Zmienne WYMAGANE na demo po rozdziale bazy (CSRF_MODE=report,
//      AI_BUDGETS_ENABLED, DATABASE_URL istnieje) — z konkretną oczekiwaną wartością.
//   2. FLAGI (VITE_*/ENABLE_*/FEATURE_*) obecne na stagingu, a nieobecne na demo,
//      oraz obecne po obu stronach z RÓŻNĄ wartością. To jest lista rzeczy do
//      dosypania, nie ozdoba — kryterium 8 mówi „te same flagi ON co staging".
//   3. Rozjazd wartości „true" vs „1" jest traktowany jako ZGODNY (obie formy
//      są prawdziwe dla czytników flag), ale wypisywany jako INFO — żeby nie
//      generować fałszywych „ŹLE" i zarazem nie chować rozjazdu.
//
// CZEGO NIE ROBI: nie drukuje ŻADNEJ wartości sekretnej. Wypisywane są nazwy
// zmiennych, a wartości tylko dla nazw z listy jawnych (poniżej).
// =============================================================================
import fs from 'node:fs';

const [, , plikStaging, plikDemo] = process.argv;
if (!plikStaging || !plikDemo) {
  console.error('Użycie: porownaj-flagi.mjs <staging.json> <demo.json>');
  process.exit(2);
}

const s = JSON.parse(fs.readFileSync(plikStaging, 'utf8'));
const d = JSON.parse(fs.readFileSync(plikDemo, 'utf8'));

// Nazwy, których wartość WOLNO wypisać (nie są sekretami).
const JAWNE = new Set([
  'CSRF_MODE',
  'AI_BUDGETS_ENABLED',
  'APP_ENV',
  'NODE_ENV',
  'FRONTEND_URL',
  'DB_TYPE',
  'RELEASE_TARGET_DB_HOST_FINGERPRINT',
  'DISABLE_RATE_LIMIT',
  'API_RATE_LIMIT_MAX',
]);

// Wymagane na demo po rozdziale: nazwa → oczekiwana wartość (null = „ma istnieć").
const WYMAGANE = {
  CSRF_MODE: 'report',
  AI_BUDGETS_ENABLED: 'true',
  DATABASE_URL: null,
  APP_ENV: 'demo',
  FRONTEND_URL: 'https://demo.consultify.ai',
};

const linie = [];
const powiedz = (znak, tekst) => linie.push(`${znak.padEnd(9)} ${tekst}`);

for (const [k, oczekiwana] of Object.entries(WYMAGANE)) {
  const jest = d[k];
  if (jest === undefined || String(jest) === '') {
    powiedz('ŹLE', `flagi: demo NIE MA zmiennej ${k}${oczekiwana ? ` (ma być „${oczekiwana}")` : ''}`);
  } else if (oczekiwana !== null && String(jest) !== oczekiwana) {
    const pokaz = JAWNE.has(k) ? `jest „${jest}"` : '(wartość ukryta)';
    powiedz('ŹLE', `flagi: ${k} ${pokaz}, ma być „${oczekiwana}"`);
  } else {
    powiedz('OK', `flagi: ${k} ustawione${JAWNE.has(k) ? ` = „${jest}"` : ''}`);
  }
}

const jestFlaga = (k) => /^(VITE_|ENABLE_|FEATURE_)/.test(k);
const znormalizuj = (v) => {
  const t = String(v).trim().toLowerCase();
  if (t === '1' || t === 'true' || t === 'on' || t === 'yes') return 'true';
  if (t === '0' || t === 'false' || t === 'off' || t === 'no') return 'false';
  return t;
};

const brakujace = Object.keys(s)
  .filter((k) => jestFlaga(k) && d[k] === undefined)
  .sort();
const rozjazd = Object.keys(s)
  .filter((k) => jestFlaga(k) && d[k] !== undefined && znormalizuj(s[k]) !== znormalizuj(d[k]))
  .sort();
const forma = Object.keys(s)
  .filter(
    (k) => jestFlaga(k) && d[k] !== undefined && String(s[k]) !== String(d[k]) && znormalizuj(s[k]) === znormalizuj(d[k])
  )
  .sort();

if (brakujace.length === 0) powiedz('OK', 'flagi: demo ma wszystkie flagi obecne na stagingu');
else powiedz('ŹLE', `flagi: na demo BRAKUJE ${brakujace.length} flag ze stagingu: ${brakujace.join(' ')}`);

if (rozjazd.length === 0) powiedz('OK', 'flagi: żadna wspólna flaga nie ma sprzecznej wartości');
else powiedz('ŹLE', `flagi: ${rozjazd.length} flag o SPRZECZNEJ wartości: ${rozjazd.join(' ')}`);

if (forma.length > 0) powiedz('INFO', `flagi: ${forma.length} flag zapisanych inną formą tej samej prawdy (1 vs true): ${forma.join(' ')}`);

const tylkoDemo = Object.keys(d)
  .filter((k) => jestFlaga(k) && s[k] === undefined)
  .sort();
if (tylkoDemo.length > 0)
  powiedz('INFO', `flagi: ${tylkoDemo.length} flag jest TYLKO na demo (staging ich nie ma): ${tylkoDemo.join(' ')}`);

console.log(linie.join('\n'));
