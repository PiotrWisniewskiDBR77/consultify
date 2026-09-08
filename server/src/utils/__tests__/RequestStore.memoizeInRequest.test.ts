/**
 * WYDAJNOSC [ODMROZENIE 06_EXECUTION DEC-453] — `memoizeInRequest`.
 *
 * Po co. Pomiar 2026-09-08 na kopii danych DBR77 pokazal, ze pojedyncze zadanie
 * `GET /api/initiatives/runtime-v1/execution-cases/<id>/allocations` zadawalo
 * bazie te same pytania po kilka razy: status czlonkostwa, status uzytkownika,
 * seed szablonow rol. Sa to funkcje czyste wzgledem argumentow — w obrebie
 * JEDNEGO zadania ten sam argument daje ten sam wynik, wiec round-tripy byly
 * czysta strata (28 zapytan na zadanie, po naprawach 15).
 *
 * Ten mechanizm musi spelniac trzy warunki naraz i kazdy z nich jest tu pilnowany:
 *  1) w obrebie zadania liczy raz,
 *  2) NIC nie przecieka miedzy zadaniami (inaczej byloby to cache uprawnien
 *     miedzy uzytkownikami — dziura bezpieczenstwa, nie optymalizacja),
 *  3) poza zadaniem HTTP (skrypty, konsumenci kolejek, testy) nie pamieta nic.
 *
 * MUTACJA RED (sprawdzona recznie 2026-09-08): usuniecie odczytu z `store.memo`
 * w `memoizeInRequest` wywraca test „liczy raz"; zwrocenie wspolnego store'a
 * poza `storage.run` wywraca „dwa zadania nie widza swoich wynikow".
 */
import { describe, expect, it, vi } from 'vitest';

import { correlationMiddleware, memoizeInRequest } from '../RequestStore.js';

/** Uruchamia `praca()` w srodku sztucznego zadania HTTP (tak jak robi to Express). */
function wZadaniu<T>(praca: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const req = { get: () => undefined, headers: {} } as never;
    const res = { set: () => undefined } as never;
    correlationMiddleware(req, res, () => {
      praca().then(resolve, reject);
    });
  });
}

describe('memoizeInRequest [DEC-453]', () => {
  it('w obrebie jednego zadania liczy RAZ, mimo wielu wywolan', async () => {
    const fabryka = vi.fn(async () => 'wynik');

    const wyniki = await wZadaniu(async () =>
      Promise.all([
        memoizeInRequest('k', fabryka),
        memoizeInRequest('k', fabryka),
        memoizeInRequest('k', fabryka),
        memoizeInRequest('k', fabryka),
      ])
    );

    expect(wyniki).toEqual(['wynik', 'wynik', 'wynik', 'wynik']);
    expect(fabryka).toHaveBeenCalledTimes(1);
  });

  it('rozne klucze licza sie osobno', async () => {
    const fabryka = vi.fn(async (k: string) => k);

    await wZadaniu(async () => {
      await memoizeInRequest('a', () => fabryka('a'));
      await memoizeInRequest('b', () => fabryka('b'));
      await memoizeInRequest('a', () => fabryka('a'));
    });

    expect(fabryka).toHaveBeenCalledTimes(2);
  });

  it('DWA zadania nie widza swoich wynikow — nic nie przecieka miedzy zadaniami', async () => {
    const fabryka = vi.fn(async () => 'x');

    await wZadaniu(async () => {
      await memoizeInRequest('wspolny-klucz', fabryka);
    });
    await wZadaniu(async () => {
      await memoizeInRequest('wspolny-klucz', fabryka);
    });

    // gdyby pamiec byla modulowa zamiast per-zadanie, byloby 1 — i uprawnienia
    // policzone dla jednego uzytkownika oddawaloby sie drugiemu
    expect(fabryka).toHaveBeenCalledTimes(2);
  });

  it('poza zadaniem HTTP nie pamieta nic', async () => {
    const fabryka = vi.fn(async () => 'y');

    await memoizeInRequest('k', fabryka);
    await memoizeInRequest('k', fabryka);

    expect(fabryka).toHaveBeenCalledTimes(2);
  });

  it('blad nie przykleja sie do zadania — kolejne wywolanie probuje od nowa', async () => {
    let wolania = 0;
    const fabryka = vi.fn(async () => {
      wolania += 1;
      if (wolania === 1) throw new Error('chwilowa awaria bazy');
      return 'juz-dziala';
    });

    const wynik = await wZadaniu(async () => {
      await expect(memoizeInRequest('k', fabryka)).rejects.toThrow('chwilowa awaria bazy');
      // gdyby odrzucona obietnica zostala w pamieci, cale zadanie widzialoby
      // od teraz „brak uprawnien" mimo ze baza juz odpowiada
      return memoizeInRequest('k', fabryka);
    });

    expect(wynik).toBe('juz-dziala');
    expect(fabryka).toHaveBeenCalledTimes(2);
  });
});
