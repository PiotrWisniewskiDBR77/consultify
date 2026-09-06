/**
 * @vitest-environment node
 *
 * DEC-426 (1.1-E-1, właściciel 06.09): Kokpit menedżera (zakładka `summary`)
 * NIE miał Menu 3 — dwa panele obok siebie zastąpiono chipem-przełącznikiem
 * (Ryzyka/Rozstrzygnięcia) + jedną tabelą pełnej szerokości (patrz
 * `ExecutionSummaryOneLook.viewToggle.test.tsx` dla komponentu). ExecutionHub
 * jest zbyt ciężki, by montować w teście jednostkowym (patrz sąsiednie pliki
 * `ExecutionHub.entityLookup.test.tsx` / `executionModuleTabs.test.ts`) —
 * ten test blokuje regres na źródle, dokładnie tym samym wzorcem.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const executionHubSource = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

describe('Kokpit menedżera — Menu 3 (Ryzyka/Rozstrzygnięcia), DEC-426', () => {
  it('getExecutionMenu3 deklaruje dokładnie dwa chipy dla zakładki summary', () => {
    const start = executionHubSource.indexOf('function getExecutionMenu3');
    const end = executionHubSource.indexOf('\n}', executionHubSource.indexOf('summary: [', start));
    const summaryBlock = executionHubSource.slice(start, end);
    expect(summaryBlock).toContain("['ryzyka'");
    expect(summaryBlock).toContain("['rozstrzygniecia'");
  });

  it('domyślnie aktywny chip to "ryzyka" (KROK 3, test a)', () => {
    const start = executionHubSource.indexOf('const [canonicalMenu3Preset, setCanonicalMenu3Preset]');
    const end = executionHubSource.indexOf('});', start);
    const block = executionHubSource.slice(start, end);
    expect(block).toContain("summary: 'ryzyka'");
  });

  it('deep-link czyta ?kokpit= i akceptuje TYLKO ryzyka|rozstrzygniecia', () => {
    expect(executionHubSource).toContain("searchParams.get('kokpit')");
    expect(executionHubSource).toContain(
      "targetKokpit === 'ryzyka' || targetKokpit === 'rozstrzygniecia'"
    );
    expect(executionHubSource).toContain(
      'setCanonicalMenu3Preset((current) => ({ ...current, summary: targetKokpit }))'
    );
  });

  it('stan → URL: ?kokpit= odzwierciedla chip TYLKO na zakładce summary', () => {
    expect(executionHubSource).toContain(
      "activeTab === 'summary' ? canonicalMenu3Preset.summary || 'ryzyka' : ''"
    );
  });

  it('ExecutionSummaryOneLook dostaje activeView pochodzący z tego samego stanu (nie osobny)', () => {
    const idx = executionHubSource.indexOf('<ExecutionSummaryOneLook');
    const end = executionHubSource.indexOf('/>', idx);
    const block = executionHubSource.slice(idx, end);
    expect(block).toContain(
      "canonicalMenu3Preset.summary === 'rozstrzygniecia' ? 'rozstrzygniecia' : 'ryzyka'"
    );
  });
});
