import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { dedupeById } from '../DiscoveryToolsHub';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Plan napraw MVP 05.09.2026, pozycja (3) `tools-outputs-insights-tab`:
 * zakładka Insighty pokazywała 3 identyczne wiersze "Sekcja finansowa —
 * 2025" (duplikat u źródła zapytania/mappera) i kolumna TYP mieszała PL/EN
 * ("Raport assessment" — polskie "Raport" + angielskie "assessment").
 */
describe('dedupeById — deduplikacja outputów u źródła mappera (nie w UI)', () => {
  it('usuwa duplikaty po id, zachowując pierwsze wystąpienie i kolejność', () => {
    const rows = [
      { id: 'a', name: 'Sekcja finansowa — 2025' },
      { id: 'a', name: 'Sekcja finansowa — 2025 (duplikat 2)' },
      { id: 'a', name: 'Sekcja finansowa — 2025 (duplikat 3)' },
      { id: 'b', name: 'Q2 Strategy Report' },
    ];
    const result = dedupeById(rows);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
    // pierwsze wystąpienie wygrywa (kolejność z API zachowana)
    expect(result[0].name).toBe('Sekcja finansowa — 2025');
  });

  it('nie zmienia listy bez duplikatów', () => {
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(dedupeById(rows)).toEqual(rows);
  });

  it('działa na pustej liście', () => {
    expect(dedupeById([])).toEqual([]);
  });
});

describe('kolumna TYP — etykieta "assessment_report" jest po polsku, nie mieszana', () => {
  it('i18n pl.json: tools.hub.outputs.type.assessmentReport nie zawiera angielskiego słowa "assessment"', () => {
    const pl = JSON.parse(
      readFileSync(path.join(root, 'public/locales/pl/translation.json'), 'utf8')
    );
    const label = pl?.tools?.hub?.outputs?.type?.assessmentReport;
    expect(label).toBe('Raport oceny');
    expect(label.toLowerCase()).not.toContain('assessment');
  });

  it('DiscoveryToolsHub.tsx: etykieta TYP dla assessment_report w wariancie polskim nie zawiera "assessment"', () => {
    const hub = readFileSync(
      path.join(root, 'src/components/Discovery/DiscoveryToolsHub.tsx'),
      'utf8'
    );
    // Dowód mutacyjny wsteczny: dawny defekt to dosłowny literał
    // isPolish ? 'Raport assessment' : ... — pilnujemy, że go nie ma.
    expect(hub).not.toContain("'Raport assessment'");
    expect(hub).toContain("isPolish ? 'Raport oceny' : 'Assessment report'");
  });
});
