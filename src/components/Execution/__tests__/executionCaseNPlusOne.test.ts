/**
 * N+1 ekranu Realizacji — POMIAR LICZBY ZADAN, nie „czy sie renderuje".
 *
 * PREMISA (pomiar wydajnosci stagingu 2026-09-11,
 * `docs/program/PRZEKAZANIE_KODOWANIA_20260907/POMIAR_WYDAJNOSCI_STAGING_20260911.md`:
 * Realizacja LCP 11,4 s): zakladka Praca pobierala `…/<id>/work` OSOBNO dla
 * kazdej realizacji, a Zasoby dodatkowo `…/<id>/allocations` — 1 + N oraz
 * 1 + 2N zadan HTTP na jedno wejscie w ekran.
 *
 * CO TEN TEST MIERZY: liczbe realnych wywolan `fetch` dla DZIESIECIU realizacji,
 * przy tym samym skladzie wywolan, jaki maja powierzchnie
 * (`ExecutionWorkSurface.loadAll`, `ExecutionResourcesSurface.loadCases`):
 * `prefetchExecutionCaseBundles` -> `fanOutExecutionCases`.
 *
 * DOWOD MUTACYJNY (do wykonania recznie przy kazdej zmianie tych plikow):
 * usun uzycie `bundles` w `loadOne` (albo kaz `prefetchExecutionCaseBundles`
 * zwracac `null`) — przypadek „Zasoby" wraca na 21 wywolan i test jest czerwony.
 * Wykonany 2026-09-11: PO mutacji 21 > 3, PASS -> FAIL.
 *
 * OSOBNY STRAZNIK NA KONCU pliku sprawdza, ze obie powierzchnie NAPRAWDE wolaja
 * zbiorcze pobranie — biblioteka bez wolacza nie jest naprawa.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readExecutionCaseBundles,
  readExecutionWork,
  readOperationalAllocations,
} from '@/services/initiatives-execution/runtimeApi';

import { fanOutExecutionCases, prefetchExecutionCaseBundles } from '../executionCaseFanOut';

const CASES = Array.from({ length: 10 }, (_, index) => ({
  executionCaseId: `case-${index + 1}`,
}));

let wywolaneUrle: string[] = [];

/** Atrapa serwera: `bulk` odpowiada, chyba ze test kaze udawac stary serwer. */
function zamontujFetch(options: { bulkDziala: boolean }) {
  wywolaneUrle = [];
  const fetchMock = vi.fn(async (input: any) => {
    const url = String(input);
    wywolaneUrle.push(url);
    if (url.includes('/execution-cases/bulk')) {
      if (!options.bulkDziala) {
        return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const ids = decodeURIComponent(url.split('ids=')[1] ?? '').split(',');
      return new Response(
        JSON.stringify({
          cases: ids.map((executionCaseId) => ({
            executionCaseId,
            work: { tasks: [{ taskId: `${executionCaseId}-t`, title: 'Zadanie' }], decisions: [] },
            allocations: { items: [{ allocationId: `${executionCaseId}-a`, taskId: `${executionCaseId}-t` }] },
          })),
          missingIds: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.endsWith('/work')) {
      return new Response(JSON.stringify({ tasks: [{ taskId: 't', title: 'Zadanie' }], decisions: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/allocations')) {
      return new Response(JSON.stringify({ items: [{ allocationId: 'a', taskId: 't' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
}

/** Dokladnie ten sam sklad, co `ExecutionResourcesSurface.loadCases`. */
async function zasoby(uzyjZbiorczego: boolean) {
  const bundles = uzyjZbiorczego
    ? await prefetchExecutionCaseBundles(
        CASES.map((item) => item.executionCaseId),
        (ids, signal) => readExecutionCaseBundles(ids, signal)
      )
    : null;
  return fanOutExecutionCases<any>(CASES, async (executionCase: any, signal) => {
    const bundle = bundles?.get(executionCase.executionCaseId);
    const [result, work] = bundle
      ? [bundle.allocations, bundle.work]
      : ((await Promise.all([
          readOperationalAllocations(executionCase.executionCaseId, signal),
          readExecutionWork(executionCase.executionCaseId, signal),
        ])) as any[]);
    return (result.items ?? []).map((item: any) => ({
      ...item,
      executionCaseId: executionCase.executionCaseId,
      taskTitle: (work.tasks ?? []).find((task: any) => task.taskId === item.taskId)?.title,
    }));
  });
}

/** Dokladnie ten sam sklad, co `ExecutionWorkSurface.loadAll`. */
async function praca(uzyjZbiorczego: boolean) {
  const bundles = uzyjZbiorczego
    ? await prefetchExecutionCaseBundles(
        CASES.map((item) => item.executionCaseId),
        (ids, signal) => readExecutionCaseBundles(ids, signal)
      )
    : null;
  return fanOutExecutionCases<any>(CASES, async (executionCase: any, signal) => {
    const bundle = bundles?.get(executionCase.executionCaseId);
    const work = bundle ?? null ? bundle!.work : ((await readExecutionWork(executionCase.executionCaseId, signal)) as any);
    return (work.tasks ?? []).map((task: any) => ({ ...task, executionCaseId: executionCase.executionCaseId }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Realizacja — N+1 w pobieraniu danych ekranu', () => {
  beforeEach(() => {
    zamontujFetch({ bulkDziala: true });
  });

  it('PRZED: Zasoby robily 2 zadania na realizacje (10 realizacji = 20 zadan)', async () => {
    const wynik = await zasoby(false);
    expect(wywolaneUrle.length).toBe(20);
    expect(wywolaneUrle.length).toBeGreaterThanOrEqual(20);
    expect(wynik.items).toHaveLength(10);
    expect(wynik.failedCaseIds).toEqual([]);
  });

  it('PO: Zasoby robia JEDNO zbiorcze zadanie (<= 3), z tymi samymi wierszami', async () => {
    const wynik = await zasoby(true);
    expect(wywolaneUrle.length).toBeLessThanOrEqual(3);
    expect(wywolaneUrle.filter((url) => url.includes('/execution-cases/bulk'))).toHaveLength(1);
    expect(wywolaneUrle.filter((url) => url.endsWith('/allocations'))).toHaveLength(0);
    expect(wynik.items).toHaveLength(10);
    expect(wynik.items[0].taskTitle).toBe('Zadanie');
    expect(wynik.failedCaseIds).toEqual([]);
  });

  it('PRZED/PO dla Pracy: 10 zadan -> 1 zadanie, te same wiersze', async () => {
    const przed = await praca(false);
    const liczbaPrzed = wywolaneUrle.length;
    zamontujFetch({ bulkDziala: true });
    const po = await praca(true);
    expect(liczbaPrzed).toBe(10);
    expect(wywolaneUrle.length).toBeLessThanOrEqual(3);
    expect(po.items).toHaveLength(przed.items.length);
  });

  it('PARYTET: gdy serwer nie zna trasy zbiorczej (404), ekran schodzi na stara sciezke', async () => {
    zamontujFetch({ bulkDziala: false });
    const wynik = await zasoby(true);
    // 1 nieudane zbiorcze + 2 zadania na realizacje = 21; dane KOMPLETNE.
    expect(wywolaneUrle.filter((url) => url.endsWith('/allocations'))).toHaveLength(10);
    expect(wynik.items).toHaveLength(10);
    expect(wynik.items[0].taskTitle).toBe('Zadanie');
    expect(wynik.failedCaseIds).toEqual([]);
  });
});

describe('straznik wolacza — zbiorcze pobranie jest PODLACZONE', () => {
  it('obie powierzchnie wolaja prefetchExecutionCaseBundles przed wachlarzem', () => {
    for (const plik of ['ExecutionWorkSurface.tsx', 'ExecutionResourcesSurface.tsx']) {
      const zrodlo = readFileSync(path.join(__dirname, '..', plik), 'utf8');
      expect(zrodlo).toContain('prefetchExecutionCaseBundles');
      expect(zrodlo).toContain('readExecutionCaseBundles');
      expect(zrodlo.indexOf('prefetchExecutionCaseBundles(')).toBeLessThan(
        zrodlo.indexOf('fanOutExecutionCases<')
      );
    }
  });
});
