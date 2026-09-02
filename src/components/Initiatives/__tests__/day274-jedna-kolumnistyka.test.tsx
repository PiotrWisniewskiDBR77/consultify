import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createInitiativeRegisterColumns,
  createInitiativeRegisterRowMenu,
  INITIATIVE_REGISTER_COLUMN_IDS,
  type InitiativeRegisterRow,
} from '../initiativeRegisterColumns.shared';

const ROOT = process.cwd();
const surfaceSources = [
  'src/components/Initiatives/CanonicalInitiativeRegister.tsx',
  'src/components/assessment/AssessmentHub.tsx',
  'src/components/assessment/manage/InitiativesManagementPanel.tsx',
];

const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('Day 274 — jeden kontrakt listy inicjatyw', () => {
  it('utrzymuje dziesięć identyfikatorów kolumn w ustalonej kolejności', () => {
    const renderedByThreeSurfaces = surfaceSources.map(() =>
      createInitiativeRegisterColumns().map((column) => column.id)
    );

    expect(renderedByThreeSurfaces).toEqual([
      [...INITIATIVE_REGISTER_COLUMN_IDS],
      [...INITIATIVE_REGISTER_COLUMN_IDS],
      [...INITIATIVE_REGISTER_COLUMN_IDS],
    ]);
  });

  it('utrzymuje te same pozycje kebaba na trzech powierzchniach', () => {
    const row = { id: 'day274', name: 'Day 274', status: 'DRAFT' } as InitiativeRegisterRow;
    const positions = surfaceSources.map(() => {
      const menu = createInitiativeRegisterRowMenu({ row, onOpen: () => {}, onPreview: () => {} });
      return [
        ...(menu.primary || []).map((item) => item.id),
        ...(menu.statusTransitions || []).map((item) => item.id),
        ...(menu.timeActions || []).map((item) => item.id),
        ...Object.entries(menu.universalHandlers || {})
          .filter(([, value]) => typeof value === 'function' || typeof value === 'string')
          .map(([key]) => key),
        ...(menu.destructive ? ['destructive'] : []),
      ];
    });
    expect(positions[1]).toEqual(positions[0]);
    expect(positions[2]).toEqual(positions[0]);
  });

  it('każda żywa powierzchnia woła wspólny builder i nie deklaruje lokalnego kontraktu', () => {
    for (const relativePath of surfaceSources) {
      const source = read(relativePath);
      expect(source).toContain('createInitiativeRegisterColumns');
      expect(source).toContain('createInitiativeRegisterRowMenu');
    }

    const hub = read(surfaceSources[1]);
    const defaultColumnsAt = hub.indexOf('// Default: assessment list');
    const initiativeColumnsAt = hub.lastIndexOf(
      "if (activeTab === 'initiatives')",
      defaultColumnsAt
    );
    const hubInitiativeBranch = hub.slice(initiativeColumnsAt, defaultColumnsAt);
    expect(hubInitiativeBranch).toContain('return createInitiativeRegisterColumns();');
    expect(hubInitiativeBranch).not.toMatch(/return\s*\[/);

    const panel = read(surfaceSources[2]);
    expect(panel).toContain(
      'const columns = useMemo(() => createInitiativeRegisterColumns(), []);'
    );
    expect(panel).not.toContain('const columns: StandardTableColumn[]');
  });

  it('panel Oceny nie opakowuje tabeli w ramkę-kartę raportu w raporcie', () => {
    const panel = read(surfaceSources[2]);
    const tableAt = panel.indexOf('<StandardTable');
    const nearestWrapper = panel.slice(Math.max(0, tableAt - 15_000), tableAt);
    expect(nearestWrapper).not.toContain(
      'rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden'
    );
  });
});
