/**
 * B-E0 — reguły przekładu wskaźnik → poziom ryzyka (DEC-487).
 *
 * Ten test broni trzech rzeczy, których „ekran wygląda dobrze" nie sprawdza:
 *  1. progi 0,95 i 0,85 są DOKŁADNIE te same co na serwerze
 *     (`threeAxisReportService.ts:161`) — rozjazd oznaczałby, że pastylka
 *     przeczy raportowi policzonemu z tych samych liczb,
 *  2. brak danych zostaje brakiem (UNKNOWN), a nie zielenią,
 *  3. poziom 3 (jedyny crimson) zaczyna się dopiero pod 0,70.
 */
import { describe, expect, it } from 'vitest';

import {
  buildExecutionRiskSignal,
  buildExecutionRiskSignalMap,
  executionRiskLevelFromRatio,
  worstExecutionRiskLevel,
} from '../executionRiskSignal';

describe('executionRiskSignal — poziomy z wskaźnika', () => {
  it.each([
    [1.2, 0],
    [0.95, 0],
    [0.9499, 1],
    [0.85, 1],
    [0.8499, 2],
    [0.7, 2],
    [0.6999, 3],
    [0, 3],
  ])('ratio %s → poziom %s', (ratio, expected) => {
    expect(executionRiskLevelFromRatio({ ratio })).toBe(expected);
  });

  it('brak wskaźnika i rag NA to UNKNOWN, nigdy zieleń', () => {
    expect(executionRiskLevelFromRatio(null)).toBe('UNKNOWN');
    expect(executionRiskLevelFromRatio({ ratio: null })).toBe('UNKNOWN');
    expect(executionRiskLevelFromRatio({ ratio: Number.NaN })).toBe('UNKNOWN');
    // Serwer ustawia NA tylko wtedy, gdy nie miał z czego liczyć — wtedy
    // liczba (gdyby jakaś przyszła) nie jest pomiarem.
    expect(executionRiskLevelFromRatio({ ratio: 1.5, rag: 'NA' })).toBe('UNKNOWN');
  });
});

describe('executionRiskSignal — worst-of-three', () => {
  it('bierze najgorszą ZMIERZONĄ oś, a brak danych jej nie zastępuje', () => {
    expect(worstExecutionRiskLevel([0, 'UNKNOWN', 2])).toBe(2);
    expect(worstExecutionRiskLevel(['UNKNOWN', 'UNKNOWN', 1])).toBe(1);
  });

  it('UNKNOWN dopiero gdy ŻADNA oś nie ma danych', () => {
    expect(worstExecutionRiskLevel(['UNKNOWN', 'UNKNOWN', 'UNKNOWN'])).toBe('UNKNOWN');
  });
});

describe('executionRiskSignal — sygnał wiersza', () => {
  it('składa trzy osie w stałej kolejności i liczy ile zmierzono', () => {
    const signal = buildExecutionRiskSignal({
      initiativeId: 'ini-1',
      scheduleHealth: { ratio: 0.91, rag: 'AMBER' },
      impactGap: { ratio: 0.4, rag: 'RED' },
      deliveryPromise: { ratio: null, rag: 'NA' },
    });
    expect(signal.axes.map((axis) => axis.id)).toEqual(['schedule', 'impact', 'promise']);
    expect(signal.axes.map((axis) => axis.level)).toEqual([1, 3, 'UNKNOWN']);
    expect(signal.worst).toBe(3);
    expect(signal.worstIconId).toBe('escalate');
    expect(signal.measuredAxes).toBe(2);
  });

  it('każda oś niesie ikonę razem z poziomem — nigdy sam kolor', () => {
    const signal = buildExecutionRiskSignal({
      initiativeId: 'ini-2',
      scheduleHealth: { ratio: 1 },
      impactGap: { ratio: 0.8 },
      deliveryPromise: { ratio: 0.5 },
    });
    expect(signal.axes.map((axis) => axis.iconId)).toEqual(['ok', 'act', 'escalate']);
  });

  it('mapa pomija wiersze bez identyfikatora inicjatywy', () => {
    const map = buildExecutionRiskSignalMap([
      { initiativeId: 'ini-1', scheduleHealth: { ratio: 1 } },
      { initiativeId: '   ', scheduleHealth: { ratio: 0.2 } },
    ] as never);
    expect([...map.keys()]).toEqual(['ini-1']);
  });
});
