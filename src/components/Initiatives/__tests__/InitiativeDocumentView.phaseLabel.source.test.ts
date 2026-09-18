/**
 * @vitest-environment node
 *
 * [ODMROZENIE 05_INITIATIVES DEC-607] H1c (Wpis 97, wiersz 53) — call-site
 * pillu „Faza" w `InitiativeDocumentView.tsx`.
 *
 * Wpis 97 wymaga DOKŁADNIE JEDNEJ zmienionej linii w tym pliku (gałąź `else`
 * `phaseDisplayLabel`): z `(isPolish ? moduleConfig.labelPl : moduleConfig.label)`
 * na `t(phaseLabelKeyForStatus(status))`. Gałąź `definitionApprovalV2 →
 * 'Preparation'` zostaje nietknięta.
 *
 * Dlaczego na ŹRÓDLE: `InitiativeDocumentView` ma kilka tysięcy linii i zależy
 * od całego drzewa modułu — montowanie w vitest jest kosztowne i kruche (ten sam
 * wzorzec co `InitiativeDocumentView.titlePrecedence.source.test.ts`).
 *
 * MUTACJA: przywrócenie `moduleConfig.label` w gałęzi `else` → oba `it` poniżej
 * czerwone (asercja `not.toContain` starej formy + `toContain` nowej).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const view = readFileSync(new URL('../InitiativeDocumentView.tsx', import.meta.url), 'utf8');

const PHASE_BLOCK = `  const phaseDisplayLabel = definitionApprovalV2 && ['REGISTERED_DRAFT', 'DEFINED', 'ANALYZING'].includes(initiative?.lifecycle)
    ? (isPolish ? 'Przygotowanie' : 'Preparation')
    : t(phaseLabelKeyForStatus(status));`;

describe('H1c — InitiativeDocumentView: pill „Faza" bierze etykietę fazy, nie nazwę modułu', () => {
  it('importuje phaseLabelKeyForStatus z initiativeLifecycle', () => {
    expect(view).toContain('phaseLabelKeyForStatus');
    expect(view).toMatch(/from '@\/services\/initiativeLifecycle';/);
  });

  it('gałąź else phaseDisplayLabel wywołuje t(phaseLabelKeyForStatus(status)) — DOKŁADNIE ta jedna linia', () => {
    expect(view).toContain(PHASE_BLOCK);
    expect(view).toContain(': t(phaseLabelKeyForStatus(status));');
  });

  it('gałąź definitionApprovalV2 → "Preparation" zostaje nietknięta', () => {
    expect(view).toContain("? (isPolish ? 'Przygotowanie' : 'Preparation')");
  });

  it('stara forma (spadek na nazwę modułu) NIE występuje w gałęzi else phaseDisplayLabel', () => {
    expect(view).not.toContain(': (isPolish ? moduleConfig.labelPl : moduleConfig.label);');
  });
});
