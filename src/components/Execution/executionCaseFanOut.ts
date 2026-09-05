/**
 * Wachlarz „po jednej realizacji" dla zakładek Praca i Zasoby.
 *
 * DLACZEGO ISTNIEJE (pomiar 2026-09-05, odbiór na żywo, `execution-tab-work`
 * i `execution-tab-resources`):
 * obie powierzchnie pobierały dane każdej realizacji przez
 * `await Promise.all(cases.map(...))`. Na stagingu JEDNA realizacja
 * (`a3e05d4a-…--acceptance--execution-case`) ma endpoint
 * `/api/initiatives/runtime-v1/execution-cases/<id>/work`, który NIE ODPOWIADA
 * (curl: 30 s bez nagłówka, nie 500, nie 404 — wisi). `Promise.all` czeka na
 * najwolniejszą obietnicę, więc jedna wisząca realizacja zabijała CAŁĄ zakładkę:
 *   · Praca — „Loading canonical work" na zawsze, liczniki Menu 3 na zerach,
 *   · Zasoby — pusty biały obszar (ta powierzchnia nie ma nawet stanu ładowania),
 * mimo że pozostałe 5 realizacji odpowiadało 200 z danymi.
 *
 * KONTRAKT: jedna realizacja, która wisi albo zwraca błąd, degraduje się do
 * SIEBIE SAMEJ — reszta listy renderuje się normalnie, a wołający dostaje listę
 * identyfikatorów, których nie udało się pobrać (do uczciwego komunikatu).
 *
 * Dlaczego ORAZ abort ORAZ wyścig z zegarem: `AbortSignal` przerywa realne
 * `fetch` (nie zostawia wiszącego połączenia), ale honoruje go tylko ten, kto
 * signal przyjmuje. Wyścig jest zabezpieczeniem dla wołających, którzy signalu
 * nie przekażą — bez niego jeden taki wołacz przywraca dokładnie ten defekt.
 */

/** Ile czekamy na JEDNĄ realizację, zanim uznamy ją za niedostępną. */
export const EXECUTION_CASE_FANOUT_TIMEOUT_MS = 12_000;

export interface ExecutionCaseFanOutResult<T> {
  /** Wiersze ze WSZYSTKICH realizacji, które odpowiedziały (spłaszczone). */
  items: T[];
  /** Identyfikatory realizacji, które nie odpowiedziały (błąd albo przekroczony czas). */
  failedCaseIds: string[];
}

class ExecutionCaseTimeoutError extends Error {
  constructor(caseId: string, timeoutMs: number) {
    super(`Execution case ${caseId} did not answer within ${timeoutMs} ms`);
    this.name = 'ExecutionCaseTimeoutError';
  }
}

export async function fanOutExecutionCases<T>(
  cases: ReadonlyArray<{ executionCaseId: string }>,
  loadOne: (executionCase: any, signal: AbortSignal) => Promise<T[]>,
  options?: { timeoutMs?: number }
): Promise<ExecutionCaseFanOutResult<T>> {
  const timeoutMs = options?.timeoutMs ?? EXECUTION_CASE_FANOUT_TIMEOUT_MS;
  const settled = await Promise.all(
    (cases ?? []).map(async (executionCase) => {
      const caseId = String(executionCase?.executionCaseId ?? '');
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const guard = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ExecutionCaseTimeoutError(caseId, timeoutMs));
        }, timeoutMs);
      });
      try {
        const items = await Promise.race([loadOne(executionCase, controller.signal), guard]);
        return { ok: true as const, caseId, items: items ?? [] };
      } catch {
        return { ok: false as const, caseId, items: [] as T[] };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })
  );
  return {
    items: settled.flatMap((entry) => entry.items),
    failedCaseIds: settled.filter((entry) => !entry.ok).map((entry) => entry.caseId),
  };
}
