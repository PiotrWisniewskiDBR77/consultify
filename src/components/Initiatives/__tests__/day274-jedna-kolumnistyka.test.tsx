import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createInitiativeRegisterColumns,
  createInitiativeRegisterRowMenu,
  INITIATIVE_REGISTER_COLUMN_IDS,
  INITIATIVE_REGISTER_OPTIONAL_COLUMN_IDS,
  resolveInitiativeRegisterLifecycle,
  type InitiativeRegisterRow,
} from '../initiativeRegisterColumns.shared';

const ROOT = process.cwd();

/**
 * Dyżur 274 ustalił JEDEN kontrakt kolumn. Uwaga właściciela A19/A13
 * (2026-09-05) pokazała, że to za mało: powierzchnie Oceny brały te same
 * kolumny, ale własną POWŁOKĘ (bez podglądu, `density="compact"`, własny pusty
 * stan) i karmiły je drugim słownikiem statusów. Ten plik pilnuje dziś obu
 * rzeczy: jednej definicji ORAZ jednego komponentu tabeli.
 */
const registerHost = 'src/components/Initiatives/CanonicalInitiativeRegister.tsx';
const delegatingSurfaces = [
  'src/components/assessment/manage/InitiativesManagementPanel.tsx',
  'src/components/Initiatives/InitiativesHub.tsx',
];

const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

/**
 * Bramka patrzy na KOD, nie na komentarze — inaczej zdanie „było: własny
 * <StandardTable>" w uzasadnieniu naprawy wywracałoby własny test.
 */
const readCode = (relativePath: string) =>
  read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');

describe('Day 274 + A19/A13 — jeden kontrakt listy inicjatyw', () => {
  it('utrzymuje dziesięć identyfikatorów kolumn w ustalonej kolejności', () => {
    expect(createInitiativeRegisterColumns().map((column) => column.id)).toEqual([
      ...INITIATIVE_REGISTER_COLUMN_IDS,
    ]);
  });

  it('kolumna kontekstu wchodzi jako opcja TEJ SAMEJ definicji, przed kolumną sortowania', () => {
    const ids = createInitiativeRegisterColumns({ includeSource: true }).map(
      (column) => column.id
    );
    expect(ids).toHaveLength(INITIATIVE_REGISTER_COLUMN_IDS.length + 1);
    expect(ids).toContain(INITIATIVE_REGISTER_OPTIONAL_COLUMN_IDS[0]);
    expect(ids.at(-1)).toBe('updatedAt');
    // Bez opcji kolumna NIE pojawia się nigdzie — inaczej „opcjonalna" byłaby fikcją.
    expect(createInitiativeRegisterColumns().map((c) => c.id)).not.toContain('source');
  });

  it('czyta legacy słownik statusów Oceny tym samym kodem co rejestr kanoniczny', () => {
    // Rejestr kanoniczny (runtime-v1)
    expect(resolveInitiativeRegisterLifecycle({ status: 'IN_EXECUTION' } as InitiativeRegisterRow)).toBe(
      'IN_EXECUTION'
    );
    // Ocena / legacy endpointy
    expect(resolveInitiativeRegisterLifecycle({ status: 'DRAFT' } as InitiativeRegisterRow)).toBe(
      'REGISTERED_DRAFT'
    );
    expect(resolveInitiativeRegisterLifecycle({ status: 'EXECUTING' } as InitiativeRegisterRow)).toBe(
      'IN_EXECUTION'
    );
  });

  it('utrzymuje te same pozycje kebaba niezależnie od powierzchni', () => {
    const row = { id: 'day274', name: 'Day 274', status: 'DRAFT' } as InitiativeRegisterRow;
    const menu = createInitiativeRegisterRowMenu({ row, onOpen: () => {}, onPreview: () => {} });
    expect((menu.primary || []).map((item) => item.id)).toEqual(['open']);
    expect(Object.keys(menu.universalHandlers || {})).toEqual(['preview', 'archiveNote']);
  });

  it('powierzchnie NIE montują własnej tabeli — delegują do jednego komponentu', () => {
    for (const relativePath of delegatingSurfaces) {
      const source = readCode(relativePath);
      expect(source).toContain('<CanonicalInitiativeRegister');
      // Nikt poza hostem rejestru nie buduje własnego zestawu kolumn ani kebaba.
      expect(source).not.toContain('createInitiativeRegisterColumns');
      expect(source).not.toContain('const columns: StandardTableColumn[]');
    }
    expect(readCode(registerHost)).toContain('createInitiativeRegisterColumns');
  });

  it('panel Oceny nie opakowuje tabeli w ramkę-kartę raportu w raporcie', () => {
    const panel = readCode(delegatingSurfaces[0]);
    const tableAt = panel.indexOf('<CanonicalInitiativeRegister');
    const nearestWrapper = panel.slice(Math.max(0, tableAt - 15_000), tableAt);
    expect(nearestWrapper).not.toContain(
      'rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden'
    );
    // Regresja A13: powrót do własnego `<StandardTable>` w panelu Oceny.
    expect(panel).not.toContain('<StandardTable');
    expect(panel).not.toContain('density="compact"');
  });
});
