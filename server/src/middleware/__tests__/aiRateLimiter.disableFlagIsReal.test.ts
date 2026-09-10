/** @vitest-environment node */

/**
 * P3 — Obserwowalność i limiter AI (MVP koszyk 2, S2.6).
 *
 * Zlecenie kazało zweryfikować, czy `DISABLE_RATE_LIMIT` faktycznie steruje
 * limiterem AI, czy jest fantomem (w tym projekcie zdarzały się flagi bez
 * implementacji). Dowód: wołamy wyeksportowany middleware `aiRateLimiter`
 * bezpośrednio (bez serwera HTTP, bez sieci) i liczymy ile z serii zapytań
 * przechodzi (`next()` wywołane) kontra ile zostaje zablokowanych (429).
 *
 * PRZED (staging dziś, DISABLE_RATE_LIMIT=true): limiter przepuszcza WSZYSTKO —
 * `isRateLimitBypassed()` w rateLimiting.middleware.ts zwraca `true`, bo
 * `NODE_ENV` na stagingu ('staging') != 'production', więc flaga działa.
 * PO (bez DISABLE_RATE_LIMIT): limiter liczy i blokuje po przekroczeniu progu
 * (200/min poza produkcją) z kodem RATE_LIMIT_EXCEEDED (429). Treść komunikatu
 * zostaje po angielsku po stronie serwera świadomie — J0 (docs/program/
 * JEZYK_EN_PL_20260908) zakazuje hardkodowania polskich zdań w kodzie serwera
 * (K5pl); tłumaczenie ma iść po `code`, patrz `src/utils/apiErrorFallbacks.ts`
 * i `errors.RATE_LIMIT_EXCEEDED`. UWAGA (spisana w meldunku): helper, który miał
 * to tłumaczenie realnie zastosować (`src/utils/translateApiError.ts`, J17), nie
 * ma dziś ŻADNEGO wołacza w `src/` — więc mimo poprawnej rejestracji kodu, 429
 * z tego limitera nadal renderuje się po angielsku w UI. To osobny dług, nie
 * przedmiot tego testu.
 *
 * `NODE_ENV=test` bypassowałoby WSZYSTKO bezwarunkowo (pierwsza linia
 * `isRateLimitBypassed`), więc oba scenariusze tymczasowo ustawiają
 * `NODE_ENV='staging'`, żeby zmierzyć realną ścieżkę produkcyjną/stagingową,
 * a nie ścieżkę testową.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { aiRateLimiter } from '../rateLimiting.middleware.js';

function makeReqRes(userId: string) {
  const req: any = {
    method: 'POST',
    userId,
    headers: {},
    ip: '127.0.0.1',
    socket: {},
  };
  let statusCode = 200;
  let jsonBody: any = null;
  const res: any = {
    headersSent: false,
    setHeader: () => undefined,
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: unknown) {
      jsonBody = body;
      return res;
    },
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };
}

async function fireOnce(req: unknown, res: unknown): Promise<boolean> {
  let nextCalled = false;
  await new Promise<void>((resolve) => {
    (aiRateLimiter as any)(req, res, () => {
      nextCalled = true;
      resolve();
    });
    // The limiter's synchronous (non-shared-store) path calls next() or
    // res.json() in the same tick; resolve regardless so a blocked call
    // (no next()) does not hang the test.
    resolve();
  });
  return nextCalled;
}

describe('aiRateLimiter — DISABLE_RATE_LIMIT nie jest fantomem (pomiar realnego wołacza)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDisable = process.env.DISABLE_RATE_LIMIT;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDisable === undefined) delete process.env.DISABLE_RATE_LIMIT;
    else process.env.DISABLE_RATE_LIMIT = originalDisable;
  });

  it('PRZED: staging + DISABLE_RATE_LIMIT=true -> 250/250 zapytań przechodzi (0 zablokowanych)', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.DISABLE_RATE_LIMIT = 'true';
    const { req, res } = makeReqRes('measure-before-disabled');

    let passed = 0;
    for (let i = 0; i < 250; i++) {
      if (await fireOnce(req, res)) passed++;
    }

    expect(passed).toBe(250);
  });

  it('PO: staging bez DISABLE_RATE_LIMIT -> blokuje po 200/min z kodem RATE_LIMIT_EXCEEDED', async () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.DISABLE_RATE_LIMIT;
    const { req, res, getStatus, getJson } = makeReqRes('measure-after-enabled');

    let passed = 0;
    let firstBlockStatus: number | null = null;
    let firstBlockBody: any = null;
    for (let i = 0; i < 210; i++) {
      const ok = await fireOnce(req, res);
      if (ok) {
        passed++;
      } else if (firstBlockBody === null) {
        firstBlockStatus = getStatus();
        firstBlockBody = getJson();
      }
    }

    expect(passed).toBe(200); // non-prod max skonfigurowany w createLimiter dla prefix 'ai'
    expect(firstBlockStatus).toBe(429);
    expect(firstBlockBody?.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
