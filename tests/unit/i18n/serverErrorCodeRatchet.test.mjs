/**
 * D-141 (Wpis 231 pkt 2, DEC-690) — RATCHET kodów błędu: każdy literał
 * `code:`/`errorCode:` w konwencji UPPER_SNAKE pod
 * `server/src/{routes,middleware,validators,schemas,controllers}` ma mieć wpis
 * w `src/utils/apiErrorFallbacks.ts` (zdanie EN) — bo od paczki
 * `apiError-unknown-code` nieznany kod renderuje się na kliencie zdaniem
 * GENERYCZNYM (`errors.generic.unknownCode`), a tylko wpis w rejestrze daje
 * użytkownikowi konkretne zdanie.
 *
 * RATCHET: stan zastany (po K5pl-MUTE-8, 19.09: 1006 kodów bez wpisu) jest
 * zamrożony w `serverErrorCodeRatchet.kody.baseline.json` (kod → adres pierwszego
 * wystąpienia). Test pada, gdy pojawi się NOWY kod spoza baseline'u i bez wpisu
 * w rejestrze („nie rośnie"). Wpis z baseline'u wolno USUNĄĆ, gdy kod dostanie
 * zdanie w `apiErrorFallbacks.ts` — wtedy test „ratchet w dół" wymusza usunięcie.
 *
 * Poza zakresem (świadomie, zgodnie ze zleceniem „UPPER_SNAKE"): kody
 * jednowyrazowe (`UNAUTHORIZED`, `FORBIDDEN`) i wartości enum w danych
 * (`CAPEX`, `REV`) — wymagamy co najmniej jednego podkreślnika.
 *
 * MUTACJA DOWODOWA: dopisz w dowolnym routerze
 *   res.status(400).json({ code: 'NOWY_KOD_BEZ_REJESTRU' });
 * — test staje się czerwony.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASELINE_PLIK = path.join(
  ROOT,
  'tests/unit/i18n/serverErrorCodeRatchet.kody.baseline.json'
);
const REJESTR_PLIK = path.join(ROOT, 'src/utils/apiErrorFallbacks.ts');

const KATALOGI = [
  'server/src/routes',
  'server/src/middleware',
  'server/src/validators',
  'server/src/schemas',
  'server/src/controllers',
];

/** UPPER_SNAKE: wielkie litery/cyfry, co najmniej jeden podkreślnik. */
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

function listujPliki(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listujPliki(p);
    if (!e.name.endsWith('.ts')) return [];
    if (/\.(test|spec)\.ts$/.test(e.name)) return [];
    return [p];
  });
}

/** Kody rejestrów EN: `  KOD: '...'` w apiErrorFallbacks.ts. */
function kodyRejestru(rootDir = ROOT) {
  const src = fs.readFileSync(path.join(rootDir, REJESTR_PLIK.slice(ROOT.length + 1)), 'utf8');
  return new Set([...src.matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*:/gm)].map((m) => m[1]));
}

/**
 * Wszystkie literały `code:`/`errorCode:` UPPER_SNAKE w katalogach serwera.
 * Zwraca Map<kod, pierwszyAdres(plik:linia)>.
 */
export function znajdzKody(rootDir = ROOT) {
  const znalezione = new Map();
  for (const katalog of KATALOGI) {
    for (const plik of listujPliki(path.join(rootDir, katalog))) {
      const src = fs.readFileSync(plik, 'utf8');
      const rel = path.relative(rootDir, plik);
      for (const m of src.matchAll(/\b(?:errorCode|code)\s*:\s*['"]([A-Za-z0-9_.:-]+)['"]/g)) {
        if (!UPPER_SNAKE.test(m[1])) continue;
        if (!znalezione.has(m[1])) {
          const linia = src.slice(0, m.index).split('\n').length;
          znalezione.set(m[1], `${rel}:${linia}`);
        }
      }
    }
  }
  return znalezione;
}

describe('D-141 — kod błędu serwera ma zdanie w apiErrorFallbacks.ts (ratchet)', () => {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PLIK, 'utf8')).wyjatki;
  const zamrozone = new Set(Object.keys(baseline));

  it('skaner w ogóle coś widzi (bezpiecznik: brak pomiaru to nie wynik)', () => {
    const pliki = KATALOGI.flatMap((k) => listujPliki(path.join(ROOT, k)));
    assert.ok(pliki.length > 500, `skaner znalazł tylko ${pliki.length} plików serwera`);
    const kody = znajdzKody();
    assert.ok(kody.size > 500, `skaner znalazł tylko ${kody.size} kodów`);
    assert.ok(kodyRejestru().size > 100, 'rejestr apiErrorFallbacks.ts wygląda na pusty');
  });

  it('klasyfikacja UPPER_SNAKE: konwencja vs nie-konwencja', () => {
    assert.equal(UPPER_SNAKE.test('ASSESSMENT_ID_REQUIRED'), true);
    assert.equal(UPPER_SNAKE.test('V8_SYNC_FAILED'), true);
    assert.equal(UPPER_SNAKE.test('UNAUTHORIZED'), false); // jednowyrazowy — poza zleceniem
    assert.equal(UPPER_SNAKE.test('lowercase_code'), false);
    assert.equal(UPPER_SNAKE.test('HTTP-404'), false);
  });

  it('zero NOWYCH kodów bez wpisu w rejestrze (baseline „nie rośnie")', () => {
    const rejestry = kodyRejestru();
    const kody = znajdzKody();
    const naruszenia = [...kody.entries()]
      .filter(([kod]) => !rejestry.has(kod) && !zamrozone.has(kod))
      .map(([kod, adres]) => `${kod} (${adres})`);
    assert.deepEqual(
      naruszenia,
      [],
      `Nowe kody błędu BEZ zdania w src/utils/apiErrorFallbacks.ts (${naruszenia.length}):\n` +
        naruszenia.join('\n') +
        '\n\nNapraw: dodaj kod z angielskim zdaniem do API_ERROR_FALLBACKS_EN' +
        ' (i parę errors.<CODE> w public/locales/{en,pl}/translation.json).' +
        ' Bez wpisu klient renderuje zdanie generyczne (errors.generic.unknownCode).'
    );
  });

  it('ratchet w dół: kod z baseline′a, który dostał wpis w rejestrze, znika z baseline′a', () => {
    const rejestry = kodyRejestru();
    const naprawione = [...zamrozone].filter((kod) => rejestry.has(kod));
    assert.deepEqual(
      naprawione,
      [],
      `Te kody mają już zdanie w apiErrorFallbacks.ts — usuń je z ${path.basename(BASELINE_PLIK)}:\n` +
        naprawione.join('\n')
    );
  });
});
