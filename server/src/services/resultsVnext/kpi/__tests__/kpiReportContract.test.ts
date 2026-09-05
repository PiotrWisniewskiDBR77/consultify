/**
 * P7K — jednostkowe dowody dla trzech reguł, które decydują o LICZBACH
 * w raporcie KPI. Wszystkie trzy są czystymi funkcjami, więc dają się
 * zmierzyć bez bazy; ścieżkę bazową broni osobny test `.pg`.
 *
 * DOWÓD MUTACYJNY — każdy blok kończy twierdzeniem, które pada, gdy usunie się
 * dokładnie to zabezpieczenie, którego dotyczy (a nie mechanizm obok):
 *   · `resolvePeriodTarget` — usunięcie pierwszeństwa KOLUMNY nad zapisem
 *     seeda sprawia, że test „kolumna wygrywa" pada;
 *   · `resolveYtdAggregation` — zamiana `unknown` na domyślne `sum` sprawia,
 *     że test „bez jednostki YTD się NIE liczy" pada (a to jest właśnie
 *     granica między uczciwym »nie wiem« a liczbą z sufitu);
 *   · `evaluateAgainstPeriodTarget` — usunięcie porównania z limitem [%]
 *     sprawia, że test „ostrzeżenie vs krytyczne" pada.
 */
import { describe, expect, it } from 'vitest';

import {
  buildScorecardPeriodGrid,
  resolvePeriodTarget,
  resolveYtdAggregation,
} from '../kpiScorecardRepository.js';
import {
  evaluateAgainstPeriodTarget,
  resolveTargetDirection,
} from '../kpiPeriodEvaluation.js';

describe('P7K — siatka okresów raportu', () => {
  it('miesięczny raport ma DWANAŚCIE kolumn, także tam, gdzie nie ma pomiarów', () => {
    const grid = buildScorecardPeriodGrid(2026, 'month', new Date('2026-09-15T00:00:00.000Z'));
    expect(grid).toHaveLength(12);
    expect(grid[0]?.key).toBe('2026-01');
    expect(grid[11]?.key).toBe('2026-12');
    // Miesiąc bez pomiaru MUSI istnieć jako kolumna — inaczej raport cicho
    // gubiłby okres zamiast pokazać w nim „—".
    expect(grid.map((p) => p.key)).toContain('2026-12');
  });

  it('okres bieżący jest wskazany dokładnie jeden raz', () => {
    const grid = buildScorecardPeriodGrid(2026, 'month', new Date('2026-09-15T00:00:00.000Z'));
    expect(grid.filter((p) => p.isCurrent).map((p) => p.key)).toEqual(['2026-09']);
  });

  it('kwartalny raport ma cztery kolumny, roczny jedną', () => {
    expect(buildScorecardPeriodGrid(2026, 'quarter', new Date('2026-09-15T00:00:00.000Z'))).toHaveLength(4);
    expect(buildScorecardPeriodGrid(2026, 'year', new Date('2026-09-15T00:00:00.000Z'))).toHaveLength(1);
  });
});

describe('P7K — CEL okresu: kolumna wygrywa, zapis seeda jest tylko fallbackiem', () => {
  const seedRefs = [{ kind: 'seed_period_target', seed: 'seed:wyniki-dbr77-20260905', targetValue: 11400 }];

  it('bierze wartość z KOLUMNY, gdy jest', () => {
    expect(resolvePeriodTarget(12400, seedRefs)).toBe(12400);
    // NUMERIC wraca ze sterownika `pg` jako tekst — obie drogi muszą dać to samo.
    expect(resolvePeriodTarget('12400', seedRefs)).toBe(12400);
  });

  it('spada do zapisu seeda dopiero przy PUSTEJ kolumnie', () => {
    expect(resolvePeriodTarget(null, seedRefs)).toBe(11400);
  });

  it('nie podstawia niczego, gdy nie ma ani kolumny, ani zapisu seeda', () => {
    expect(resolvePeriodTarget(null, [])).toBeNull();
    expect(resolvePeriodTarget(null, null)).toBeNull();
    // Obcy wpis dowodu NIE jest celem okresu — cel ma jawny `kind`.
    expect(resolvePeriodTarget(null, [{ kind: 'attachment', targetValue: 999 }])).toBeNull();
  });
});

describe('P7K — reguła agregacji YTD wynika z JEDNOSTKI, nie z domysłu', () => {
  it('procent się uśrednia, reszta sumuje', () => {
    expect(resolveYtdAggregation('%')).toBe('average');
    expect(resolveYtdAggregation('LC/1000')).toBe('sum');
    expect(resolveYtdAggregation('szt.')).toBe('sum');
  });

  it('BEZ jednostki YTD NIE jest liczone — „nie wiem" zamiast liczby z sufitu', () => {
    expect(resolveYtdAggregation(null)).toBe('unknown');
    expect(resolveYtdAggregation('   ')).toBe('unknown');
  });
});

describe('P7K — stan wobec CELU i dopuszczalnego LIMITU [%]', () => {
  it('kierunek bierze się z geometrii celu, a nieznana geometria nie udaje kierunku', () => {
    expect(resolveTargetDirection('threshold_min')).toBe('higher_is_better');
    expect(resolveTargetDirection('threshold_max')).toBe('lower_is_better');
    expect(resolveTargetDirection('range')).toBe('unknown');
    expect(resolveTargetDirection(null)).toBe('unknown');
  });

  it('wynik lepszy lub równy celowi = w normie (oba kierunki)', () => {
    expect(
      evaluateAgainstPeriodTarget({
        actualValue: 12500,
        targetValue: 12400,
        targetGeometry: 'threshold_min',
        limitPercent: 5,
      })
    ).toBe('on_target');
    expect(
      evaluateAgainstPeriodTarget({
        actualValue: 26,
        targetValue: 28,
        targetGeometry: 'threshold_max',
        limitPercent: 5,
      })
    ).toBe('on_target');
  });

  it('niedobór MIEŚCI się w limicie = ostrzeżenie, poza limitem = krytyczne', () => {
    // 12 400 → 11 900 to −4,03 %, czyli w limicie 5 %.
    expect(
      evaluateAgainstPeriodTarget({
        actualValue: 11900,
        targetValue: 12400,
        targetGeometry: 'threshold_min',
        limitPercent: 5,
      })
    ).toBe('warning');
    // 12 400 → 11 620 to −6,29 %, czyli poza limitem 5 %.
    expect(
      evaluateAgainstPeriodTarget({
        actualValue: 11620,
        targetValue: 12400,
        targetGeometry: 'threshold_min',
        limitPercent: 5,
      })
    ).toBe('critical');
  });

  it('BRAK limitu, celu, wyniku albo kierunku = „nie wiem", nigdy „w normie"', () => {
    const base = {
      actualValue: 11620,
      targetValue: 12400,
      targetGeometry: 'threshold_min',
      limitPercent: 5,
    };
    expect(evaluateAgainstPeriodTarget({ ...base, limitPercent: null })).toBeNull();
    expect(evaluateAgainstPeriodTarget({ ...base, targetValue: null })).toBeNull();
    expect(evaluateAgainstPeriodTarget({ ...base, actualValue: null })).toBeNull();
    expect(evaluateAgainstPeriodTarget({ ...base, targetGeometry: 'range' })).toBeNull();
    // Cel zerowy nie daje procentu odchylenia — dzielenie przez zero musi
    // dać „nie wiem", a nie nieskończoność przebraną za „krytyczne".
    expect(evaluateAgainstPeriodTarget({ ...base, targetValue: 0 })).toBeNull();
  });

  it('cel UJEMNY nie odwraca znaku odchylenia', () => {
    // Cel „nie więcej niż −100" (np. wynik ujemny); −90 jest GORSZE niż −100
    // przy kierunku „im mniej, tym lepiej".
    expect(
      evaluateAgainstPeriodTarget({
        actualValue: -90,
        targetValue: -100,
        targetGeometry: 'threshold_max',
        limitPercent: 5,
      })
    ).toBe('critical');
    expect(
      evaluateAgainstPeriodTarget({
        actualValue: -110,
        targetValue: -100,
        targetGeometry: 'threshold_max',
        limitPercent: 5,
      })
    ).toBe('on_target');
  });
});
