/**
 * P7K część A — logika RAPORTU OKR bez DOM-u.
 *
 * Pilnuje trzech rzeczy, których zrzut ekranu nie udowodni:
 *  1. cztery kubełki stanu są ROZŁĄCZNE i WYCZERPUJĄCE (suma = liczba
 *     nieanulowanych rezultatów) — inaczej wiersz poziomu 1 kłamałby
 *     względem tabeli poziomu 2;
 *  2. grupowanie TEMAT → CEL nie gubi celu bez tematu ani celu bez
 *     rezultatów (obie sytuacje są w realnych danych);
 *  3. brak wartości to „—”, nigdy 0 i nigdy pusty napis (SSOT §6).
 *
 * DOWÓD MUTACYJNY (zmierzony, nie deklarowany):
 *  · zamiana w `okrReportStateOf` gałęzi `if (!hasCheckIn) return 'no-signal'`
 *    na `return 'on-track'` → pada „rezultat bez check-inu nie udaje, że
 *    idzie dobrze”;
 *  · usunięcie z `buildOkrReportRows` filtra `status !== 'cancelled'` → pada
 *    „anulowany rezultat nie jest wierszem raportu”;
 *  · zwrócenie z `formatOkrTriple` `'0 / 0 / 0'` zamiast „—” dla pustych
 *    wartości → pada „brak wartości to myślnik, nigdy zero”.
 */
import { describe, expect, it } from 'vitest';

import type {
  OkrKeyResultDto,
  OkrObjectiveWithKeyResultsDto,
} from '@/components/ResultsVNext/okr/okrObjectiveApi';
import type { OkrKeyResultCheckInSummaryDto } from '@/components/ResultsVNext/okr/p7k/okrReportApi';
import {
  buildOkrReportRows,
  collectOkrReportOwners,
  formatOkrTriple,
  okrReportStateOf,
  OKR_EMPTY,
  summarizeOkrReport,
  type OkrReportKeyResultRow,
} from '@/components/ResultsVNext/okr/p7k/okrReportModel';

function keyResult(overrides: Partial<OkrKeyResultDto> & { keyResultId: string }): OkrKeyResultDto {
  return {
    objectiveId: 'obj-1',
    setId: 'set-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    title: 'Rezultat',
    description: null,
    measurementType: 'numeric',
    unit: 'min',
    currency: null,
    baselineValue: null,
    targetValue: '28',
    startValue: '42',
    currentValue: '31',
    direction: 'decrease',
    rangeMin: null,
    rangeMax: null,
    progress: '0.79',
    progressCalcPolicyVersionId: 'pol-1',
    progressCalcReason: null,
    outOfRangeDistance: null,
    confidence: 'medium',
    confidenceNumericValue: null,
    status: 'on_track',
    sourceType: 'manual',
    sourceReference: null,
    teamName: 'Produkcja L3',
    deadline: '2026-11-30',
    weight: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as OkrKeyResultDto;
}

function objective(
  overrides: Partial<OkrObjectiveWithKeyResultsDto> & { objectiveId: string }
): OkrObjectiveWithKeyResultsDto {
  return {
    setId: 'set-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    title: 'Cel',
    description: null,
    rationale: null,
    ambitionType: 'committed',
    status: 'active',
    progress: '0.7',
    progressCalcPolicyVersionId: null,
    progressCalcReason: null,
    confidence: 'medium',
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: null,
    confidenceCalcReason: null,
    theme: 'Efektywność operacyjna',
    sortOrder: 1,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    approvedAt: null,
    keyResults: [],
    ...overrides,
  } as OkrObjectiveWithKeyResultsDto;
}

const checkedIn = (keyResultId: string): OkrKeyResultCheckInSummaryDto => ({
  keyResultId,
  lastCheckinAt: '2026-09-04T10:00:00.000Z',
  lastNote: 'Notatka',
  checkInCount: 1,
});

describe('okrReportStateOf — cztery kubełki stanu', () => {
  it('rezultat bez check-inu nie udaje, że idzie dobrze', () => {
    expect(okrReportStateOf('on_track', false)).toBe('no-signal');
    expect(okrReportStateOf('achieved', false)).toBe('no-signal');
  });

  it('mapuje siedem statusów na cztery kubełki, rozłącznie', () => {
    expect(okrReportStateOf('on_track', true)).toBe('on-track');
    expect(okrReportStateOf('achieved', true)).toBe('on-track');
    expect(okrReportStateOf('at_risk', true)).toBe('at-risk');
    expect(okrReportStateOf('off_track', true)).toBe('critical');
    expect(okrReportStateOf('not_achieved', true)).toBe('critical');
    expect(okrReportStateOf('not_started', true)).toBe('no-signal');
  });
});

describe('summarizeOkrReport — suma kubełków = liczba rezultatów', () => {
  const objectives = [
    objective({
      objectiveId: 'obj-1',
      keyResults: [
        keyResult({ keyResultId: 'kr-1', status: 'on_track' }),
        keyResult({ keyResultId: 'kr-2', status: 'at_risk' }),
        keyResult({ keyResultId: 'kr-3', status: 'off_track' }),
        keyResult({ keyResultId: 'kr-4', status: 'not_started' }),
        keyResult({ keyResultId: 'kr-5', status: 'cancelled' }),
      ],
    }),
  ];
  const checkIns = new Map(
    ['kr-1', 'kr-2', 'kr-3', 'kr-4'].map((id) => [id, checkedIn(id)] as const)
  );

  it('liczy każdy nieanulowany rezultat dokładnie raz', () => {
    const counts = summarizeOkrReport(objectives, checkIns);
    expect(counts).toEqual({ onTrack: 1, atRisk: 1, critical: 1, noSignal: 1 });
    const total = counts.onTrack + counts.atRisk + counts.critical + counts.noSignal;
    expect(total).toBe(4); // pięć rezultatów minus jeden anulowany
  });

  it('rezultat bez check-inu wpada do kubełka „bez sygnału", nie do swojego statusu', () => {
    const counts = summarizeOkrReport(objectives, new Map());
    expect(counts).toEqual({ onTrack: 0, atRisk: 0, critical: 0, noSignal: 4 });
  });
});

describe('buildOkrReportRows — grupowanie TEMAT → CEL', () => {
  const objectives = [
    objective({
      objectiveId: 'obj-1',
      title: 'Skrócić przezbrojenia',
      sortOrder: 1,
      keyResults: [keyResult({ keyResultId: 'kr-1' })],
    }),
    objective({
      objectiveId: 'obj-2',
      title: 'Cel bez tematu',
      theme: null,
      sortOrder: 2,
      keyResults: [keyResult({ keyResultId: 'kr-2', objectiveId: 'obj-2', ownerUserId: 'user-2' })],
    }),
    objective({
      objectiveId: 'obj-3',
      title: 'Cel bez rezultatów',
      theme: 'Wzrost przychodów',
      sortOrder: 3,
      keyResults: [],
    }),
    objective({ objectiveId: 'obj-4', title: 'Cel anulowany', status: 'cancelled', sortOrder: 4 }),
  ];
  const checkIns = new Map([
    ['kr-1', checkedIn('kr-1')],
    ['kr-2', checkedIn('kr-2')],
  ]);

  it('stawia wiersz grupy przed rezultatami tematu i nie gubi celu bez tematu', () => {
    const rows = buildOkrReportRows(objectives, checkIns);
    const kinds = rows.map((row) => row.kind);
    expect(kinds[0]).toBe('group');
    // Trzy grupy: dwa realne tematy + jawna grupa celu bez tematu.
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(3);
    const noThemeGroup = rows.find((row) => row.kind === 'group' && row.theme === null);
    expect(noThemeGroup).toBeDefined();
  });

  it('cel bez rezultatów ma własny wiersz — nie znika z raportu', () => {
    const rows = buildOkrReportRows(objectives, checkIns);
    const emptyObjectiveRow = rows.find(
      (row): row is OkrReportKeyResultRow =>
        row.kind === 'key-result' && (row as OkrReportKeyResultRow).objectiveId === 'obj-3'
    );
    expect(emptyObjectiveRow).toBeDefined();
    expect(emptyObjectiveRow!.keyResult).toBeNull();
  });

  it('anulowany cel nie jest wierszem raportu', () => {
    const rows = buildOkrReportRows(objectives, checkIns);
    expect(
      rows.some((row) => row.kind === 'key-result' && row.objectiveId === 'obj-4')
    ).toBe(false);
  });

  it('anulowany rezultat nie jest wierszem raportu', () => {
    const rows = buildOkrReportRows(
      [
        objective({
          objectiveId: 'obj-9',
          keyResults: [
            keyResult({ keyResultId: 'kr-live' }),
            keyResult({ keyResultId: 'kr-dead', status: 'cancelled' }),
          ],
        }),
      ],
      new Map([['kr-live', checkedIn('kr-live')]])
    );
    const ids = rows.filter((row) => row.kind === 'key-result').map((row) => row.id);
    expect(ids).toContain('kr-live');
    expect(ids).not.toContain('kr-dead');
  });

  it('filtr właściciela zawęża wiersze i usuwa grupę, która została pusta', () => {
    const rows = buildOkrReportRows(objectives, checkIns, {
      ownerUserId: 'user-2',
      bucket: 'owner',
    });
    const keyResultRows = rows.filter(
      (row): row is OkrReportKeyResultRow => row.kind === 'key-result'
    );
    expect(keyResultRows.map((row) => row.id)).toEqual(['kr-2']);
    // Została JEDNA grupa (ta z celem user-2) — nagłówki pustych grup znikają.
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(1);
  });

  it('filtr „bez check-inu" pokazuje wyłącznie rezultaty bez ani jednego wpisu', () => {
    const rows = buildOkrReportRows(objectives, new Map([['kr-1', checkedIn('kr-1')]]), {
      ownerUserId: null,
      bucket: 'missing',
    });
    const ids = rows.filter((row) => row.kind === 'key-result').map((row) => row.id);
    expect(ids).toContain('kr-2');
    expect(ids).not.toContain('kr-1');
  });
});

describe('formatOkrTriple — START / CEL / BIEŻĄCA', () => {
  it('składa trzy wartości z jednostką dopisaną RAZ', () => {
    expect(formatOkrTriple(keyResult({ keyResultId: 'kr-1' }), true)).toBe('42 / 28 / 31 min');
  });

  it('procent bierze znak z typu pomiaru, nie z pola jednostki', () => {
    const kr = keyResult({
      keyResultId: 'kr-1',
      measurementType: 'percentage',
      unit: null,
      startValue: '84',
      targetValue: '95',
      currentValue: '89',
    });
    expect(formatOkrTriple(kr, true)).toBe('84 / 95 / 89 %');
  });

  it('brak wartości to myślnik, nigdy zero', () => {
    const pusty = keyResult({
      keyResultId: 'kr-1',
      startValue: null,
      baselineValue: null,
      targetValue: null,
      currentValue: null,
    });
    expect(formatOkrTriple(pusty, true)).toBe(OKR_EMPTY);
    expect(formatOkrTriple(pusty, true)).not.toContain('0');
  });
});

describe('collectOkrReportOwners', () => {
  it('zwraca właścicieli rezultatów w kolejności pierwszego wystąpienia, bez duplikatów', () => {
    const owners = collectOkrReportOwners([
      objective({
        objectiveId: 'obj-1',
        keyResults: [
          keyResult({ keyResultId: 'kr-1', ownerUserId: 'user-b' }),
          keyResult({ keyResultId: 'kr-2', ownerUserId: 'user-a' }),
          keyResult({ keyResultId: 'kr-3', ownerUserId: 'user-b' }),
          keyResult({ keyResultId: 'kr-4', ownerUserId: 'user-c', status: 'cancelled' }),
        ],
      }),
    ]);
    expect(owners).toEqual(['user-b', 'user-a']);
  });
});
