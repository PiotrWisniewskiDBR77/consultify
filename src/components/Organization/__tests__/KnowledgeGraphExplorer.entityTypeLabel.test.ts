/**
 * Plan napraw MVP 05.09.2026, pozycja (6) `org-knowledge-graph`: chip typu
 * encji „risk" w grafie wiedzy renderował się nieprzetłumaczony — czysta
 * funkcja `entityTypeLabel` (KnowledgeGraphExplorer.tsx) zwraca surowy
 * angielski `type`, gdy klucz `organization.knowledgeGraph.entityTypes.<key>`
 * nie istnieje w pl.json. Brakowało DZIEWIĘCIU z piętnastu kanonicznych typów
 * `KGEntityType` (server/src/services/knowledgeGraph/unifiedKGService.ts):
 * project, initiative, vendor, risk, decision, goal, department, skill,
 * regulation — plus „system", widoczne na żywo w danych demo (nie jest
 * częścią kanonicznego enuma, ale realnie występuje w statystykach grafu).
 */
import { describe, expect, it } from 'vitest';

import { createRealT } from '../../../test-utils/realTranslations';
import { entityTypeLabel } from '../KnowledgeGraphExplorer';

describe('entityTypeLabel — chip typu encji przetłumaczony (nie surowy angielski fallback)', () => {
  const tPl = createRealT('pl');

  it.each([
    ['risk', 'Ryzyko'],
    ['project', 'Projekt'],
    ['initiative', 'Inicjatywa'],
    ['vendor', 'Dostawca'],
    ['decision', 'Decyzja'],
    ['goal', 'Cel'],
    ['department', 'Dział'],
    ['skill', 'Umiejętność'],
    ['regulation', 'Regulacja'],
    ['artifact', 'Artefakt'],
    ['system', 'System'],
    // Kanon sprzed tej naprawy — nie mogą się zepsuć.
    ['person', 'Osoba'],
    ['organization', 'Organizacja'],
    ['process', 'Proces'],
    ['metric', 'Miernik'],
  ])('typ "%s" -> polska etykieta "%s" (nie surowy angielski identyfikator)', (type, expected) => {
    expect(entityTypeLabel(type, tPl as any)).toBe(expected);
  });

  it('typ całkowicie nieznany nadal wraca surowy (lepszy identyfikator niż pustka)', () => {
    expect(entityTypeLabel('totally-unknown-type', tPl as any)).toBe('totally-unknown-type');
  });

  it('wielkość liter jest normalizowana przed odczytem klucza (dane bywają "Risk"/"RISK")', () => {
    expect(entityTypeLabel('Risk', tPl as any)).toBe('Ryzyko');
    expect(entityTypeLabel('RISK', tPl as any)).toBe('Ryzyko');
  });
});
