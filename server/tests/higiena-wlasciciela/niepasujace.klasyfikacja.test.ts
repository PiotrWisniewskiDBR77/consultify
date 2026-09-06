import { describe, expect, it } from 'vitest';
import { isAssessmentEmptyForScreen } from '../../scripts/higiena-wlasciciela/niepasujace.js';

// Reprodukcja STAREJ reguły (runda 2, przed naprawą tego dyżuru): sprawdzała
// WYŁĄCZNIE trzy sztywne ścieżki jsonb (drd.areas / siri.dimensions / adma.dimensions),
// ignorując `completion_percent` i dowolny klucz `method_*`. Użyta tylko jako mutant
// w teście poniżej — produkcyjny kod (niepasujace.ts) już jej nie zawiera.
function oldRule(answersJsonRaw: unknown): boolean {
  const text = typeof answersJsonRaw === 'string' ? answersJsonRaw : '';
  if (!text.trim()) return true;
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { return true; }
  const nonEmpty = (v: unknown) => v != null && typeof v === 'object' && Object.keys(v as object).length > 0;
  const drdAreas = parsed?.drd?.areas;
  const siriDims = parsed?.siri?.dimensions;
  const admaDims = parsed?.adma?.dimensions;
  return !(nonEmpty(drdAreas) || nonEmpty(siriDims) || nonEmpty(admaDims));
}

const areas39 = Object.fromEntries(
  Array.from({ length: 39 }, (_, i) => [`A${i + 1}`, { achievedLevel: 3, targetLevel: 6 }])
);

describe('isAssessmentEmptyForScreen — naprawa błędnej klasyfikacji DRD 100% (runda 2)', () => {
  it('ocena 100% DRD (answers_json.drd.areas niepuste, 39 obszarów) NIE trafia do planu', () => {
    const answersJson = JSON.stringify({ drd: { areas: areas39 } });
    expect(isAssessmentEmptyForScreen(answersJson, '100')).toBe(false);
  });

  it('SIRI/ADMA z niepustymi dimensions też zostają (klasa A)', () => {
    expect(isAssessmentEmptyForScreen(JSON.stringify({ siri: { dimensions: { d1: 3 } } }), null)).toBe(false);
    expect(isAssessmentEmptyForScreen(JSON.stringify({ adma: { dimensions: { d1: 3 } } }), null)).toBe(false);
  });

  it('ocena wypełniona w 100%, ale z innym/starszym kształtem JSON-a (brak owijki drd/siri/adma) — nowa reguła ratuje przez completion_percent; MUTACJA (stara reguła) daje RED', () => {
    // To jest dokładnie klasa błędu z b901d4a3…: rekord realnie kompletny
    // (completion_percent=100), ale ścieżka jsonb, której szuka reguła, nie trafia
    // (inny kształt/wersja zapisu answers_json — np. bez zagnieżdżenia pod 'drd').
    const answersJson = JSON.stringify({ areas: areas39, meta: { savedBy: 'legacy-importer' } });
    expect(isAssessmentEmptyForScreen(answersJson, '100')).toBe(false); // NAPRAWIONA reguła: zostaje (klasa A)
    expect(oldRule(answersJson)).toBe(true); // MUTACJA — powrót do starej reguły: RED (błędnie „zero obszarów”)
  });

  it('ocena z niepustym kluczem method_* (bez drd/siri/adma) zostaje', () => {
    expect(isAssessmentEmptyForScreen(JSON.stringify({ method_cmmi: { levels: { p1: 3 } } }), null)).toBe(false);
  });

  it('ocena naprawdę pusta (bez completion_percent, bez obszarów, bez method_*) trafia do planu', () => {
    expect(isAssessmentEmptyForScreen('{}', null)).toBe(true);
    expect(isAssessmentEmptyForScreen(null, null)).toBe(true);
    expect(isAssessmentEmptyForScreen('', '0')).toBe(true);
    expect(isAssessmentEmptyForScreen(JSON.stringify({ drd: { areas: {} } }), '0')).toBe(true);
  });

  it('completion_percent=0 lub brak nie ratuje pustej oceny (method_* pusty obiekt się nie liczy)', () => {
    expect(isAssessmentEmptyForScreen(JSON.stringify({ method_cmmi: {} }), '0')).toBe(true);
  });
});
