/**
 * „Kokpit menedżera" MUSI być osiągalny — i klikiem, i adresem.
 *
 * ZMIERZONY DEFEKT (odbiór na żywo 05.09, `execution-tab-summary`):
 * ekran `ExecutionSummaryOneLook` był zbudowany, flaga `summaryOneLook`
 * w tym środowisku WŁĄCZONA, a mimo to nieosiągalny w żaden sposób:
 *   · `?tab=summary` był przepisywany na `tab=list`, bo lista dozwolonych
 *     wartości w efekcie deep-linku nie zawierała `summary`,
 *   · w Menu 2 nie było pozycji „Kokpit" — zero `onClick`, który by tam wiódł.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): usunięcie `'summary'` z gałęzi
 * `summaryOneLookEnabled` w `executionModuleTabIds` → padają OBA testy
 * osiągalności naraz (Menu 2 i deep-link), bo obie decyzje czytają z tego
 * samego źródła. Dokładnie to rozdzielenie było przyczyną defektu.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  executionDeepLinkTabs,
  executionModuleTabIds,
  isExecutionDeepLinkTabAllowed,
} from '../executionModuleTabs';

describe('Menu 2 modułu Realizacja', () => {
  it('przy włączonej fladze kokpitu ma pozycję „summary" jako pierwszą', () => {
    expect(executionModuleTabIds({ summaryOneLookEnabled: true })).toEqual([
      'summary',
      'list',
      'work',
      'resources',
      'control',
      'reports',
    ]);
  });

  it('przy fladze OFF wygląda 1:1 jak przed zmianą (zero zmiany na żywo)', () => {
    expect(executionModuleTabIds({ summaryOneLookEnabled: false })).toEqual([
      'list',
      'work',
      'resources',
      'control',
      'reports',
    ]);
  });
});

describe('deep-link ?tab=', () => {
  it('wpuszcza summary, gdy flaga kokpitu jest włączona', () => {
    expect(isExecutionDeepLinkTabAllowed('summary', { summaryOneLookEnabled: true })).toBe(true);
  });

  it('NIE wpuszcza summary przy fladze OFF (deep-link degraduje się do listy)', () => {
    expect(isExecutionDeepLinkTabAllowed('summary', { summaryOneLookEnabled: false })).toBe(false);
  });

  it('nigdy nie gubi zakładek, które działały wcześniej', () => {
    for (const tab of ['list', 'work', 'resources', 'control', 'reports']) {
      expect(isExecutionDeepLinkTabAllowed(tab, { summaryOneLookEnabled: false })).toBe(true);
      expect(isExecutionDeepLinkTabAllowed(tab, { summaryOneLookEnabled: true })).toBe(true);
    }
  });

  it('lista deep-linku i kolejność Menu 2 to JEDNO źródło (nie da się ich rozjechać)', () => {
    for (const enabled of [true, false]) {
      expect(executionDeepLinkTabs({ summaryOneLookEnabled: enabled })).toEqual(
        executionModuleTabIds({ summaryOneLookEnabled: enabled })
      );
    }
  });
});

/**
 * Bezpiecznik przeciw „bibliotece bez wywołania": ten moduł ma wartość TYLKO
 * wtedy, gdy ExecutionHub z niego korzysta. Gdyby ktoś wrócił do własnej listy
 * w efekcie deep-linku albo do ręcznie sklejonej tablicy `tabs`, testy wyżej
 * dalej byłyby zielone, a kokpit znów zniknąłby z produktu.
 */
describe('ExecutionHub realnie z tego korzysta', () => {
  // `new URL(..., import.meta.url)` w jsdom rozwiązuje się względem atrapy
  // Location, nie względem pliku — czytamy więc ścieżką z korzenia repo.
  const hub = readFileSync(
    path.resolve(process.cwd(), 'src/components/Execution/ExecutionHub.tsx'),
    'utf8'
  );

  it('woła obie funkcje zamiast trzymać własne listy zakładek', () => {
    expect(hub).toContain('isExecutionDeepLinkTabAllowed(targetTab');
    expect(hub).toContain('executionModuleTabIds({ summaryOneLookEnabled })');
  });

  it('nie ma już zaszytej listy dozwolonych wartości ?tab=', () => {
    expect(hub).not.toContain("['list', 'work', 'resources', 'control', 'reports'].includes(");
  });

  it('renderuje kokpit dla activeTab === summary', () => {
    expect(hub).toContain("summaryOneLookEnabled && activeTab === ('summary' as ModuleTab)");
  });
});
