// Dowód mutacyjny dla bezpiecznika pary zrzutów (KSZTAŁT 19 — patrz
// docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md).
//
// Reguła programu: "zabezpieczenie bez testu, który czerwienieje po jego
// usunięciu, jest nieudowodnione." Ten plik dowodzi obu kierunków na
// PRAWDZIWYCH danych zmierzonego defektu dyżuru 233 (Monte Carlo light:
// luma 249.2, dark: luma 26.0 — różnica 223.2, dużo powyżej progu 150).
//
// Run: node --test scripts/dev/__tests__/checkScreenshotPairState.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkScreenshotPairState } from '../lib/checkScreenshotPairState.mjs';

// Zmierzone dane z artefaktów dyżuru 233 (SHA256SUMS.txt,
// /private/tmp/cx-day233-finanse-artefakty) — luma Monte Carlo.
const MEASURED_LIGHT_LUMA = 249.2;
const MEASURED_DARK_LUMA = 26.0; // realny histogram render jest ciemniejszy niż pusty formularz

test('WYŚCIG PRZYWRÓCONY (kształt 19): light bez wyniku, dark z wynikiem -> kontrola CZERWIENI SIĘ mimo ogromnej różnicy jasności', () => {
  const result = checkScreenshotPairState({
    pairName: 'panel-monte-carlo-populated',
    lightMeanLuma: MEASURED_LIGHT_LUMA,
    darkMeanLuma: MEASURED_DARK_LUMA,
    requiresResultMarker: true,
    lightHasResultMarker: false, // dokładnie zmierzony defekt: zrzut zdążył przed wynikiem
    darkHasResultMarker: true,
  });

  assert.equal(
    result.ok,
    false,
    'stary bezpiecznik (tylko luma) przepuściłby tę parę — nowy MUSI ją odrzucić'
  );
  assert.ok(
    result.reasons.some((r) => r.includes('ksztalt-19')),
    'powód odrzucenia musi wskazywać na niezgodność stanu (ksztalt-19)'
  );
});

test('KONTROLA ISTNIEJĄCEGO WYMIARU nadal działa: para-duplikat (kształt 13) też czerwienieje', () => {
  const result = checkScreenshotPairState({
    pairName: 'panel-x-duplikat',
    lightMeanLuma: 200.0,
    darkMeanLuma: 205.0, // różnica 5 << próg 150 -> wygląda jak ten sam obraz dwa razy
    requiresResultMarker: true,
    lightHasResultMarker: true,
    darkHasResultMarker: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes('ksztalt-13')));
});

test('NAPRAWIONE (po fix233): oba warianty mają wynik w DOM -> kontrola ZIELENIEJE', () => {
  const result = checkScreenshotPairState({
    pairName: 'panel-monte-carlo-populated',
    lightMeanLuma: MEASURED_LIGHT_LUMA,
    darkMeanLuma: MEASURED_DARK_LUMA,
    requiresResultMarker: true,
    lightHasResultMarker: true, // po naprawie: zrzut light czeka na [data-testid="mc-histogram"]
    darkHasResultMarker: true,
  });

  assert.equal(result.ok, true, `oczekiwano PASS, dostano: ${result.reasons.join('; ')}`);
  assert.deepEqual(result.reasons, []);
});

test('Pary bez wymogu wyniku (np. stan pusty) ignorują wymiar stanu — liczy się tylko jasność', () => {
  const result = checkScreenshotPairState({
    pairName: 'panel-driver-empty',
    lightMeanLuma: 240.0,
    darkMeanLuma: 30.0,
    requiresResultMarker: false,
  });

  assert.equal(result.ok, true);
});

test('WYŚCIG (wariant: gubi wynik w OBU wariantach naraz) -> kontrola też CZERWIENI SIĘ, nie tylko przy niezgodności', () => {
  // Silniejszy przypadek niż zwykły ksztalt-19: sama RÓWNOŚĆ obu markerów
  // (oba false) nie wystarcza — musi być obecność wyniku w OBU wariantach.
  const result = checkScreenshotPairState({
    pairName: 'panel-monte-carlo-populated',
    lightMeanLuma: MEASURED_LIGHT_LUMA,
    darkMeanLuma: MEASURED_DARK_LUMA,
    requiresResultMarker: true,
    lightHasResultMarker: false,
    darkHasResultMarker: false,
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes('ksztalt-19')));
});

test('Brak pomiaru markera przy requiresResultMarker=true jest sam w sobie błędem (nie milcząco OK)', () => {
  const result = checkScreenshotPairState({
    pairName: 'panel-scenarios-populated',
    lightMeanLuma: MEASURED_LIGHT_LUMA,
    darkMeanLuma: MEASURED_DARK_LUMA,
    requiresResultMarker: true,
    // lightHasResultMarker / darkHasResultMarker not provided -> null
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes('brak pomiaru')));
});
