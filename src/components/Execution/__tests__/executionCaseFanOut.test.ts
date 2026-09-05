/**
 * Wachlarz „po jednej realizacji" — jedna wisząca realizacja NIE MOŻE zabić reszty.
 *
 * Defekt zmierzony 05.09 na stagingu: `/api/initiatives/runtime-v1/execution-cases/
 * a3e05d4a-…--acceptance--execution-case/work` nie odpowiada (curl: 30 s bez
 * nagłówka). `Promise.all` w ExecutionWorkSurface/ExecutionResourcesSurface czeka
 * na najwolniejszą obietnicę → zakładka Praca wisiała na „Loading canonical work",
 * a Zasoby pokazywały pusty biały obszar — mimo że 5 z 6 realizacji zwracało 200.
 *
 * DOWÓD MUTACYJNY (wykonany, 2026-09-05): zamiana ciała `fanOutExecutionCases`
 * z powrotem na `await Promise.all(cases.map(loadOne))` → pierwszy test tego pliku
 * NIE KOŃCZY SIĘ (timeout vitest), a trzeci („niesie identyfikatory") wywala się
 * na braku `failedCaseIds`. Test celuje w SAM MECHANIZM ODPORNOŚCI, nie w to,
 * że dane się mapują.
 */
import { describe, expect, it } from 'vitest';

import { fanOutExecutionCases } from '../executionCaseFanOut';

const cases = [
  { executionCaseId: 'case-ok-1' },
  { executionCaseId: 'case-wisi' },
  { executionCaseId: 'case-ok-2' },
];

describe('fanOutExecutionCases', () => {
  it('zwraca wiersze pozostałych realizacji, gdy jedna nie odpowiada NIGDY', async () => {
    const result = await fanOutExecutionCases<{ id: string }>(
      cases,
      async (executionCase) => {
        if (executionCase.executionCaseId === 'case-wisi') {
          // Obietnica, która nigdy się nie rozstrzyga — dokładnie to, co robi staging.
          return new Promise<{ id: string }[]>(() => {});
        }
        return [{ id: executionCase.executionCaseId }];
      },
      { timeoutMs: 40 }
    );
    expect(result.items.map((r) => r.id)).toEqual(['case-ok-1', 'case-ok-2']);
  });

  it('przerywa wiszące żądanie sygnałem abort (nie zostawia wiszącego fetcha)', async () => {
    let abortedFor = '';
    await fanOutExecutionCases<{ id: string }>(
      cases,
      async (executionCase, signal) => {
        if (executionCase.executionCaseId === 'case-wisi') {
          signal.addEventListener('abort', () => {
            abortedFor = executionCase.executionCaseId;
          });
          return new Promise<{ id: string }[]>(() => {});
        }
        return [{ id: executionCase.executionCaseId }];
      },
      { timeoutMs: 40 }
    );
    expect(abortedFor).toBe('case-wisi');
  });

  it('niesie identyfikatory realizacji, których nie udało się pobrać', async () => {
    const result = await fanOutExecutionCases<{ id: string }>(
      cases,
      async (executionCase) => {
        if (executionCase.executionCaseId === 'case-wisi') throw new Error('500');
        return [{ id: executionCase.executionCaseId }];
      },
      { timeoutMs: 40 }
    );
    expect(result.failedCaseIds).toEqual(['case-wisi']);
    expect(result.items).toHaveLength(2);
  });

  it('nie zgłasza nikogo, gdy wszystkie realizacje odpowiadają', async () => {
    const result = await fanOutExecutionCases<{ id: string }>(
      cases,
      async (executionCase) => [{ id: executionCase.executionCaseId }],
      { timeoutMs: 40 }
    );
    expect(result.failedCaseIds).toEqual([]);
    expect(result.items).toHaveLength(3);
  });
});
