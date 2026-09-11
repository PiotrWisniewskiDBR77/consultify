/**
 * Dedupe w locie dla torow menedzera (`lanes/<lane>/problems`).
 *
 * PREMISA ZMIERZONA W KODZIE (2026-09-11): `ExecutionHub.tsx:1546-1586` odpala
 * SZESC torow w efekcie, ktorego lista zaleznosci zawiera `currentProjectId`.
 * Identyfikator projektu ustala sie PO pierwszym renderze, wiec efekt wykonuje
 * sie dwa razy i te same szesc zapytan leci dwukrotnie.
 *
 * DOWOD MUTACYJNY (wykonany 2026-09-11): zamiana `dedupeInFlight` na zwykle
 * wywolanie `start()` -> przypadek „dwa wolania w locie" widzi 2 zadania
 * zamiast 1 i jest czerwony.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetInFlightDedupe, dedupeInFlight } from '../inFlightDedupe';

beforeEach(() => {
  __resetInFlightDedupe();
});

describe('dedupeInFlight', () => {
  it('dwa wolania TEGO SAMEGO klucza w locie = JEDNO zadanie', async () => {
    const start = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'wynik';
    });
    const [a, b] = await Promise.all([
      dedupeInFlight('tor:blockers', start),
      dedupeInFlight('tor:blockers', start),
    ]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(a).toBe('wynik');
    expect(b).toBe('wynik');
  });

  it('rozne klucze ida osobno (tor i projekt nie moga sie skleic)', async () => {
    const start = vi.fn(async () => 'x');
    await Promise.all([
      dedupeInFlight('tor:blockers:', start),
      dedupeInFlight('tor:risk:', start),
      dedupeInFlight('tor:blockers:p1', start),
    ]);
    expect(start).toHaveBeenCalledTimes(3);
  });

  it('TO NIE CACHE: po rozstrzygnieciu kolejne wolanie pobiera od nowa', async () => {
    const start = vi.fn(async () => 'x');
    await dedupeInFlight('tor:blockers', start);
    await dedupeInFlight('tor:blockers', start);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('odrzucenie dociera do OBU wolajacych i nie zostawia wpisu', async () => {
    const start = vi.fn(async () => {
      throw new Error('501');
    });
    const wyniki = await Promise.allSettled([
      dedupeInFlight('tor:risk', start),
      dedupeInFlight('tor:risk', start),
    ]);
    expect(wyniki.every((w) => w.status === 'rejected')).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    const drugi = vi.fn(async () => 'ok');
    await expect(dedupeInFlight('tor:risk', drugi)).resolves.toBe('ok');
  });
});
