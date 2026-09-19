/**
 * D-29 (QC17) — strażnik warstwy WIDOKU osi ryzyka B-E0.
 *
 * Dług mierzył, że `executionRiskAxisSentence` (mapowanie `axis.reason` → 5
 * kluczy `execution.risk.reason.*` + fallback + zdanie zmierzone) nie była
 * importowana przez ŻADEN plik testowy: mutacja całego bloku `reason`
 * zostawiała `executionRiskSignal.test.ts` zielony, bo ten broni wyłącznie
 * MODELu. Ten test asertuje ARGUMENTY wołania `t` (klucz + parametry), nie
 * przetłumaczony tekst — rozjazd klucza z `public/locales/**` ma być widoczny
 * jako czerwony klucz, nie jako literał.
 */
import { describe, expect, it } from 'vitest';

import type { ExecutionRiskAxis } from '../executionRiskSignal';
import { executionRiskAxisSentence } from '../executionRiskSignalView';

type RiskT = Parameters<typeof executionRiskAxisSentence>[1];

interface RecordedCall {
  key: string;
  params?: Record<string, string | number>;
}

const makeT = (): { t: RiskT; calls: RecordedCall[] } => {
  const calls: RecordedCall[] = [];
  const t = ((key: string, _defaultValue: string, params?: Record<string, string | number>) => {
    calls.push({ key, params });
    return key;
  }) as RiskT;
  return { t, calls };
};

const axis = (over: Partial<ExecutionRiskAxis>): ExecutionRiskAxis => ({
  id: 'schedule',
  level: 0,
  iconId: 'ok',
  ratio: 0.8,
  reason: null,
  ...over,
});

describe('D-29 — executionRiskAxisSentence: zdanie zmierzone', () => {
  it('niesie klucz zdania i parametry osi/werdyktu/wskaźnika z formatem 2 miejsc', () => {
    const { t, calls } = makeT();
    const sentence = executionRiskAxisSentence(axis({ level: 2, iconId: 'act', ratio: 0.8 }), t);

    expect(sentence).toBe('execution.risk.axisSentence');
    expect(calls.at(-1)).toEqual({
      key: 'execution.risk.axisSentence',
      params: {
        axis: 'execution.risk.axis.schedule',
        verdict: 'execution.risk.level.2',
        ratio: '0.80',
      },
    });
  });

  it('ratio 1 → "1.00", czyli toFixed(2), nie surowa liczba', () => {
    const { t, calls } = makeT();
    executionRiskAxisSentence(axis({ ratio: 1 }), t);
    expect(calls.at(-1)?.params?.ratio).toBe('1.00');
  });
});

describe('D-29 — executionRiskAxisSentence: powód braku pomiaru', () => {
  it.each([
    ['no-value-baseline', 'execution.risk.reason.noValueBaseline'],
    ['no-cost-baseline', 'execution.risk.reason.noCostBaseline'],
    ['no-schedule-dates', 'execution.risk.reason.noScheduleDates'],
    ['no-progress', 'execution.risk.reason.noProgress'],
    ['cokolwiek-innego', 'execution.risk.reason.noBaselineData'],
    [null, 'execution.risk.reason.noBaselineData'],
  ] as const)('reason=%s → klucz %s', (reason, reasonKey) => {
    const { t, calls } = makeT();
    const sentence = executionRiskAxisSentence(
      axis({ level: 'UNKNOWN', iconId: 'unknown', ratio: null, reason }),
      t
    );

    expect(sentence).toBe('execution.risk.axisSentenceUnknownReason');
    expect(calls.at(-1)).toEqual({
      key: 'execution.risk.axisSentenceUnknownReason',
      params: { axis: 'execution.risk.axis.schedule', reason: reasonKey },
    });
  });

  it('zmierzony poziom przy ratio=null też idzie ścieżką powodu, nie zdania', () => {
    const { t } = makeT();
    const sentence = executionRiskAxisSentence(axis({ level: 1, iconId: 'watch', ratio: null }), t);
    expect(sentence).toBe('execution.risk.axisSentenceUnknownReason');
  });

  it('dokładnie pięć kluczy powodu istnieje w mapowaniu (dryf = RED)', () => {
    const reasons = ['no-value-baseline', 'no-cost-baseline', 'no-schedule-dates', 'no-progress'];
    const keys = new Set<string>();
    for (const reason of reasons) {
      const { t, calls } = makeT();
      executionRiskAxisSentence(axis({ level: 'UNKNOWN', ratio: null, reason }), t);
      keys.add(String(calls.at(-1)?.params?.reason));
    }
    const { t, calls } = makeT();
    executionRiskAxisSentence(axis({ level: 'UNKNOWN', ratio: null, reason: null }), t);
    keys.add(String(calls.at(-1)?.params?.reason));

    expect([...keys].sort()).toEqual([
      'execution.risk.reason.noBaselineData',
      'execution.risk.reason.noCostBaseline',
      'execution.risk.reason.noProgress',
      'execution.risk.reason.noScheduleDates',
      'execution.risk.reason.noValueBaseline',
    ]);
  });
});
