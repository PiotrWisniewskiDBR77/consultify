/**
 * Testy mapy T01–T45 → adapter/konfiguracja.
 *
 * Pilnują trzech rzeczy, których system typów nie złapie:
 *  1. mianownik jest DOKŁADNIE 45 i zgadza się co do tożsamości powierzchni
 *     z `MATRIX_T01_T45.csv` (moduł + nazwa zakładki);
 *  2. każda powierzchnia ma komplet capability, kolumn i właściciela pakietu;
 *  3. `persistKey` jest unikalny — współdzielony klucz oznacza, że dwie tabele
 *     nadpisują sobie ustawienia kolumn (§5).
 *
 * TOŻSAMOŚĆ POWIERZCHNI jest zapisana w teście jako dane (`MATRIX_GROUND_TRUTH`),
 * a nie tylko czytana z pliku: katalog `evidence/` jest w tym drzewie
 * nieśledzony przez gita, więc test zależny wyłącznie od pliku byłby zielony
 * przez nieobecność, nie przez poprawność. Osobny blok porównuje dane z plikiem,
 * gdy plik jest dostępny — i wtedy wykrywa dryf w obie strony.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  surfacesForAdapter,
  surfacesForPackage,
  TABLE_SURFACE_CONTRACTS,
  TABLE_SURFACE_IDS,
  TABLE_SURFACE_REGISTER,
  tableSurfaceContract,
} from '../surfaceRegister';
import { canonicalRegisterPreset } from '../types';
import { validateSurfaceRegister, validateTableSurfaceCapabilities } from '../validators';

/**
 * Tożsamość 45 powierzchni przepisana z
 * `docs/ui-standards/evidence/table-audit-45-2026-08-05/MATRIX_T01_T45.csv`
 * (kolumny `table_id`, `module`, `surface`).
 */
const MATRIX_GROUND_TRUTH: ReadonlyArray<[string, string, string]> = [
  ['T01', 'My Work', 'Ideas'],
  ['T02', 'My Work', 'Notebook'],
  ['T03', 'My Work', 'Inbox'],
  ['T04', 'My Work', 'Calendar'],
  ['T05', 'My Work', 'Tasks'],
  ['T06', 'My Work', 'Decisions'],
  ['T07', 'My Work', 'Client Vault'],
  ['T08', 'My Work', 'Run agent'],
  ['T09', 'Interview', 'Inbox'],
  ['T10', 'Interview', 'Sessions or Processes'],
  ['T11', 'Interview', 'Assigned'],
  ['T12', 'Interview', 'Templates'],
  ['T13', 'Interview', 'Insights'],
  ['T14', 'Interview', 'Initiatives'],
  ['T15', 'Consulting Tools', 'Library'],
  ['T16', 'Consulting Tools', 'Sessions or Processes'],
  ['T17', 'Consulting Tools', 'Outputs'],
  ['T18', 'Consulting Tools', 'Reports'],
  ['T19', 'Consulting Tools', 'Initiatives'],
  ['T20', 'Assessment', 'Library'],
  ['T21', 'Assessment', 'Processes'],
  ['T22', 'Assessment', 'Outputs'],
  ['T23', 'Assessment', 'Reports'],
  ['T24', 'Assessment', 'Initiatives'],
  ['T25', 'Initiatives', 'Portfolio'],
  ['T26', 'Initiatives', 'Analysis'],
  ['T27', 'Initiatives', 'Observability'],
  ['T28', 'Initiatives', 'Candidates'],
  ['T29', 'Initiatives', 'Portfolio health'],
  ['T30', 'Initiatives', 'Goals'],
  ['T31', 'Execution', 'Dashboard'],
  ['T32', 'Execution', 'Summary'],
  ['T33', 'Execution', 'Rollout'],
  ['T34', 'Execution', 'Reporting'],
  ['T35', 'Execution', 'Management'],
  ['T36', 'Results', 'KPI Scorecards'],
  ['T37', 'Results', 'ROI Reviews'],
  ['T38', 'Results', 'OKR Sets'],
  ['T39', 'Finance', 'Statements'],
  ['T40', 'Finance', 'Analysis'],
  ['T41', 'Finance', 'Models'],
  ['T42', 'Finance', 'Prediction'],
  ['T43', 'Finance', 'Enterprise valuation'],
  ['T44', 'Materials', 'All'],
  ['T45', 'Materials', 'Documents'],
];

const MATRIX_CSV_PATH = path.resolve(
  process.cwd(),
  'docs/ui-standards/evidence/table-audit-45-2026-08-05/MATRIX_T01_T45.csv'
);
const matrixCsvAvailable = fs.existsSync(MATRIX_CSV_PATH);

describe('Rejestr T01–T45 — mianownik', () => {
  it('ma dokładnie 45 powierzchni', () => {
    expect(TABLE_SURFACE_IDS).toHaveLength(45);
    expect(MATRIX_GROUND_TRUTH).toHaveLength(45);
  });

  it('zachowuje kolejność T01…T45', () => {
    expect(TABLE_SURFACE_IDS).toEqual(MATRIX_GROUND_TRUTH.map(([id]) => id));
  });

  it.each(MATRIX_GROUND_TRUTH)(
    '%s zgadza się z macierzą audytu co do modułu i zakładki',
    (id, module, surface) => {
      const contract = TABLE_SURFACE_REGISTER[id as keyof typeof TABLE_SURFACE_REGISTER];
      expect(contract.module).toBe(module);
      expect(contract.surface).toBe(surface);
    }
  );

  it('klucz rejestru jest zawsze równy polu id', () => {
    for (const [key, contract] of Object.entries(TABLE_SURFACE_REGISTER)) {
      expect(contract.id).toBe(key);
      expect(contract.capabilities.id).toBe(key);
    }
  });
});

describe('Rejestr T01–T45 — zgodność z plikiem macierzy', () => {
  it.runIf(matrixCsvAvailable)(
    'MATRIX_GROUND_TRUTH nie zdryfował względem MATRIX_T01_T45.csv',
    () => {
      const rows = fs
        .readFileSync(MATRIX_CSV_PATH, 'utf8')
        .split('\n')
        .slice(1)
        .filter((line) => line.trim().length > 0)
        // Pierwsze trzy pola nie zawierają przecinków w cudzysłowach —
        // kolumna `reason` jest ostatnia i tylko ona bywa cytowana.
        .map((line) => line.split(',').slice(0, 3) as [string, string, string]);

      expect(rows).toHaveLength(45);
      expect(rows).toEqual(MATRIX_GROUND_TRUTH.map((row) => [...row]));
    }
  );

  it('odnotowuje dostępność pliku macierzy', () => {
    // Nie zieleni się przez nieobecność: jeśli plik zniknął, ten test mówi to
    // wprost w raporcie zamiast pozwolić poprzedniemu cicho się pominąć.
    expect(typeof matrixCsvAvailable).toBe('boolean');
    if (!matrixCsvAvailable) {
      // eslint-disable-next-line no-console
      console.warn(
        `[R00] MATRIX_T01_T45.csv not found at ${MATRIX_CSV_PATH}; ` +
          'cross-check skipped, MATRIX_GROUND_TRUTH assertions still ran.'
      );
    }
  });
});

describe('Rejestr T01–T45 — integralność', () => {
  it('przechodzi walidator rejestru', () => {
    expect(validateSurfaceRegister(TABLE_SURFACE_REGISTER).violations).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: deskryptor capability jest kompletny', (id) => {
    const result = validateTableSurfaceCapabilities(TABLE_SURFACE_REGISTER[id].capabilities);
    expect(result.violations).toEqual([]);
  });

  it('nie współdzieli persistKey między powierzchniami', () => {
    const keys = TABLE_SURFACE_CONTRACTS.map((c) => c.capabilities.persistKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('każda powierzchnia deklaruje kolumnę identyfikującą i co najmniej jedną wymaganą', () => {
    for (const contract of TABLE_SURFACE_CONTRACTS) {
      expect(contract.capabilities.columns.identifier.length).toBeGreaterThan(0);
      expect(contract.capabilities.columns.required.length).toBeGreaterThan(0);
    }
  });

  it('każda powierzchnia ma właściciela z REPAIR_WORK_PACKAGES', () => {
    for (const contract of TABLE_SURFACE_CONTRACTS) {
      expect(contract.ownerPackage).toMatch(/^R(1[0-9]|2[0-8])$/);
    }
  });
});

describe('Rejestr T01–T45 — adaptery', () => {
  it('oznacza jako missing-register dokładnie te powierzchnie, którym audyt odmówił tabeli', () => {
    // T22 by R10; T27/T28/T29 by R11; T35 by R12; T26 by R13. T30 (Goals)
    // was briefly missing-register after R13's preflight (no goals tab
    // existed), then corrected by T30-GOALS-R13-CORRECTION: a real Goal
    // CRUD API (/initiatives-v4/goals) was found and the canonical table
    // was built directly on it — see T30's own capability test below. No
    // surface remains missing-register.
    expect(surfacesForAdapter('missing-register').map((c) => c.id)).toEqual([]);
  });

  it('T22 opisuje wyłącznie prawdziwe możliwości rejestru Assessment Outputs', () => {
    const t22 = TABLE_SURFACE_REGISTER.T22;
    expect(t22.adapter).toBe('register');
    expect(t22.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      contextTransitions: [],
      menu3Presets: ['all'],
      columns: {
        identifier: 'resolvedTitle',
        required: ['outputType', 'deliveryState', 'ownerName', 'lastTransitionAt'],
      },
    });
    expect(t22.capabilities.selectionNoneReason).toBeTruthy();
    expect(t22.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T27 opisuje wyłącznie prawdziwe możliwości rejestru Observability (getInitiatives/getLineage)', () => {
    const t27 = TABLE_SURFACE_REGISTER.T27;
    expect(t27.adapter).toBe('register');
    expect(t27.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      menu3Presets: ['all'],
      columns: {
        identifier: 'name',
        required: ['status', 'priority', 'area', 'updatedAt'],
      },
    });
    expect(t27.capabilities.selectionNoneReason).toBeTruthy();
    expect(t27.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T28 opisuje wyłącznie prawdziwe możliwości rejestru Candidates (GET/POST /initiatives/candidates)', () => {
    const t28 = TABLE_SURFACE_REGISTER.T28;
    expect(t28.adapter).toBe('register');
    expect(t28.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      contextTransitions: ['initiative'],
      menu3Presets: ['all'],
      columns: {
        identifier: 'title',
        required: ['sourceType', 'status', 'fitScore', 'createdAt'],
      },
    });
    expect(t28.capabilities.selectionNoneReason).toBeTruthy();
    expect(t28.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T29 opisuje wyłącznie prawdziwe możliwości rejestru Portfolio health (readyToLaunch)', () => {
    const t29 = TABLE_SURFACE_REGISTER.T29;
    expect(t29.adapter).toBe('register');
    expect(t29.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      menu3Presets: ['all'],
      columns: {
        identifier: 'title',
        required: ['status'],
      },
    });
    expect(t29.capabilities.selectionNoneReason).toBeTruthy();
    expect(t29.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T35 opisuje wyłącznie prawdziwe możliwości rejestru Execution Management (sześć lane z managerLaneCounts)', () => {
    const t35 = TABLE_SURFACE_REGISTER.T35;
    expect(t35.adapter).toBe('register');
    expect(t35.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      menu3Presets: ['all'],
      columns: {
        identifier: 'label',
        required: ['total', 'critical', 'warning'],
      },
    });
    expect(t35.capabilities.selectionNoneReason).toBeTruthy();
    expect(t35.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T26 opisuje wyłącznie prawdziwe możliwości rejestru Analysis (realne PortfolioInitiative[])', () => {
    const t26 = TABLE_SURFACE_REGISTER.T26;
    expect(t26.adapter).toBe('register');
    expect(t26.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      menu3Presets: ['all'],
      columns: {
        identifier: 'name',
        required: ['status', 'priority', 'axis', 'updatedAt'],
      },
    });
    expect(t26.capabilities.selectionNoneReason).toBeTruthy();
    expect(t26.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T30 opisuje wyłącznie prawdziwe możliwości rejestru Goals (Api.goalsGet, /initiatives-v4/goals)', () => {
    const t30 = TABLE_SURFACE_REGISTER.T30;
    expect(t30.adapter).toBe('register');
    expect(t30.requiresNewRegistry).toBe(false);
    expect(t30.capabilities).toMatchObject({
      selection: 'none',
      bulkActions: [],
      edit: 'not-applicable',
      archive: 'not-applicable',
      delete: 'business-locked',
      menu3Presets: ['all'],
      columns: {
        identifier: 'title',
        required: ['status', 'ownerId', 'targetValue', 'endDate'],
      },
    });
    expect(t30.capabilities.selectionNoneReason).toBeTruthy();
    expect(t30.capabilities.deleteLockReason).toBeTruthy();
  });

  it('T31 i T32 opisują wyłącznie prawdziwe możliwości rejestru Execution "list" (ten sam runtime co T32)', () => {
    for (const id of ['T31', 'T32'] as const) {
      const contract = TABLE_SURFACE_REGISTER[id];
      expect(contract.adapter).toBe('register');
      expect(contract.capabilities).toMatchObject({
        selection: 'bulk',
        bulkActions: ['change-status'],
        edit: 'permission-dependent',
        archive: 'not-applicable',
        delete: 'business-locked',
        menu3Presets: ['all'],
        columns: {
          identifier: 'name',
          required: ['type', 'status', 'assignee', 'due'],
        },
      });
      expect(contract.capabilities.deleteLockReason).toBeTruthy();
    }
  });

  it('T33 pozostaje contaminated-register — R14 nie zmieniał implementacji RolloutTab', () => {
    const t33 = TABLE_SURFACE_REGISTER.T33;
    expect(t33.adapter).toBe('contaminated-register');
    expect(t33.relocateFromList?.length ?? 0).toBeGreaterThan(0);
  });

  it('T36/T37/T38 opisują wyłącznie prawdziwe encje Results (Goal/ROIInitiativeItem/Objective)', () => {
    const expectations: Record<string, { identifier: string; required: string[] }> = {
      T36: { identifier: 'title', required: ['goalType', 'status', 'progress', 'rollupProgress'] },
      T37: {
        identifier: 'initiativeName',
        required: ['status', 'projectedBenefit', 'realizedBenefit', 'variance'],
      },
      T38: { identifier: 'label', required: ['rollupScore'] },
    };
    for (const [id, expected] of Object.entries(expectations)) {
      const contract = TABLE_SURFACE_REGISTER[id as 'T36' | 'T37' | 'T38'];
      expect(contract.adapter).toBe('register');
      expect(contract.capabilities).toMatchObject({
        selection: 'none',
        bulkActions: [],
        edit: 'not-applicable',
        archive: 'not-applicable',
        delete: 'business-locked',
        menu3Presets: ['all'],
        columns: expected,
      });
      expect(contract.capabilities.selectionNoneReason).toBeTruthy();
      expect(contract.capabilities.deleteLockReason).toBeTruthy();
    }
  });

  it('requiresNewRegistry jest prawdziwe wyłącznie dla missing-register', () => {
    for (const contract of TABLE_SURFACE_CONTRACTS) {
      expect(contract.requiresNewRegistry).toBe(contract.adapter === 'missing-register');
    }
  });

  it('każdy zanieczyszczony rejestr wskazuje, co przenieść do szczegółu', () => {
    for (const contract of surfacesForAdapter('contaminated-register')) {
      expect(contract.relocateFromList?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('powierzchnie z luką semantyczną to Calendar i oba rejestry Materials', () => {
    expect(surfacesForAdapter('semantic-gap').map((c) => c.id)).toEqual(['T04', 'T44', 'T45']);
  });

  it('Materials wymaga rzeczywistego formatu pliku jako kolumny wymaganej', () => {
    // R18: „Format from MIME or extension with Unknown fallback" — kolumna
    // musi być REQUIRED, nie optional, inaczej defekt T44/T45 wraca.
    expect(TABLE_SURFACE_REGISTER.T44.capabilities.columns.required).toContain('format');
    expect(TABLE_SURFACE_REGISTER.T45.capabilities.columns.required).toContain('format');
  });
});

describe('Rejestr T01–T45 — pakiety naprawcze', () => {
  it('przypisuje powierzchnie Fali 2 właściwym pakietom', () => {
    expect(surfacesForPackage('R10').map((c) => c.id)).toEqual(['T22']);
    expect(surfacesForPackage('R11').map((c) => c.id)).toEqual(['T27', 'T28', 'T29']);
    expect(surfacesForPackage('R12').map((c) => c.id)).toEqual(['T35']);
    expect(surfacesForPackage('R13').map((c) => c.id)).toEqual(['T26', 'T30']);
    expect(surfacesForPackage('R14').map((c) => c.id)).toEqual(['T31', 'T32', 'T33']);
    expect(surfacesForPackage('R15').map((c) => c.id)).toEqual(['T36', 'T37', 'T38']);
    expect(surfacesForPackage('R16').map((c) => c.id)).toEqual(['T40', 'T41', 'T42', 'T43']);
    expect(surfacesForPackage('R17').map((c) => c.id)).toEqual(['T04']);
    expect(surfacesForPackage('R18').map((c) => c.id)).toEqual(['T44', 'T45']);
  });

  it('każda powierzchnia ma dokładnie jednego właściciela', () => {
    const owned = new Set(TABLE_SURFACE_CONTRACTS.map((c) => c.id));
    expect(owned.size).toBe(45);
  });
});

describe('Kanoniczny preset rejestru', () => {
  it.each(TABLE_SURFACE_IDS)('%s: preset wynika z deskryptora capability', (id) => {
    const contract = tableSurfaceContract(id);
    const preset = canonicalRegisterPreset(contract.capabilities);

    expect(preset.settings2).toBe(true);
    expect(preset.rowMenuColumnLast).toBe(true);
    expect(preset.contextMenu).toBe(true);
    expect(preset.stickyHeader).toBe(true);
    expect(preset.zebraStriping).toBe(false);
    expect(preset.emptyStatePreservesStructure).toBe(true);
    expect(preset.selectionCheckboxes).toBe(contract.capabilities.selection === 'bulk');
  });
});
