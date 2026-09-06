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

/**
 * TEN SAM limit i TEN SAM abort dla POJEDYNCZEJ realizacji.
 *
 * POWOD (pomiar 1.12-R2, 2026-09-06): `ExecutionResourcesSurface.load(id)`
 * — wybor jednej realizacji z listy Menu 2 — robil goly
 * `Promise.all([readExecutionCase, readOperationalAllocations, readExecutionWork])`
 * BEZ signalu i BEZ limitu. Wachlarz powyzej chronil tylko sciezke „wszystkie
 * realizacje"; klikniecie w wiszaca realizacje przywracalo defekt w calosci
 * (`useDeferredLoading` po 15 s pokazywal `ErrorState variant="timeout"`,
 * a wiszacy fetch zostawal otwarty).
 *
 * KONTRAKT: zwraca wynik albo rzuca po `timeoutMs`, przerywajac realne
 * zadania sygnalem — wolajacy odroznia „nie odpowiada" od „blad".
 */
export async function loadExecutionCaseWithTimeout<T>(
  caseId: string,
  loadOne: (signal: AbortSignal) => Promise<T>,
  options?: { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? EXECUTION_CASE_FANOUT_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ExecutionCaseTimeoutError(caseId, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([loadOne(controller.signal), guard]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export const isExecutionCaseTimeout = (error: unknown) =>
  error instanceof Error && error.name === 'ExecutionCaseTimeoutError';

/**
 * `onCaseSettled` — RENDER PRZYROSTOWY (1.12-R2, 2026-09-06).
 *
 * Sam wachlarz konczy sie dopiero, gdy zamknie sie NAJWOLNIEJSZA realizacja
 * (`Promise.all`), czyli przy wiszacej realizacji po pelnych 12 sekundach.
 * Zmierzony skutek: pierwszy wiersz tabeli pojawial sie po 12 s, mimo ze
 * dane pozostalych realizacji lezaly gotowe po ~200 ms. Ten callback wola sie
 * PO KAZDEJ realizacji z osobna, wiec wolajacy moze pokazac to, co juz ma.
 */
export interface ExecutionCaseFanOutOptions<T> {
  timeoutMs?: number;
  onCaseSettled?: (entry: { caseId: string; ok: boolean; items: T[] }) => void;
}

export async function fanOutExecutionCases<T>(
  cases: ReadonlyArray<{ executionCaseId: string }>,
  loadOne: (executionCase: any, signal: AbortSignal) => Promise<T[]>,
  options?: ExecutionCaseFanOutOptions<T>
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
        const settledEntry = { ok: true as const, caseId, items: items ?? [] };
        options?.onCaseSettled?.(settledEntry);
        return settledEntry;
      } catch {
        const settledEntry = { ok: false as const, caseId, items: [] as T[] };
        options?.onCaseSettled?.(settledEntry);
        return settledEntry;
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
