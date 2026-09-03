/**
 * CHAT-OWN-016 — mapper bledow dostawcy AI.
 *
 * Test negatywny (obowiazkowy): gdy do CIALA odpowiedzi wroci surowa tresc
 * dostawcy, test jest czerwony. To on broni zabezpieczenia, nie mechanizmu —
 * skasowanie mapowania w `mapProviderError` wywraca go natychmiast.
 */
import { describe, expect, it } from 'vitest';

import {
  classifyProviderError,
  looksLikeProviderDetail,
  mapProviderError,
  toSafeErrorBody,
  toSafeSseFrame,
} from '../providerErrorMapper.js';

/** Realne ksztalty bledow zmierzone na sciezce /api/ai/chat/stream. */
const CASES: Array<{
  nazwa: string;
  err: unknown;
  errorCode: string;
  httpStatus: number;
}> = [
  {
    nazwa: '429 limit zapytan dostawcy',
    err: Object.assign(new Error('Rate limit exceeded for model gpt-4o-mini'), { status: 429 }),
    errorCode: 'AI_RATE_LIMIT',
    httpStatus: 429,
  },
  {
    nazwa: '401 zly klucz (dostawca odbija echem fragment klucza)',
    err: new Error('Incorrect API key provided: sk-or-v1-9f3a****. Check https://openrouter.ai/keys'),
    errorCode: 'AI_CONFIG',
    httpStatus: 503,
  },
  {
    nazwa: 'brak skonfigurowanego dostawcy',
    err: { code: 'NO_LLM_PROVIDER' },
    errorCode: 'AI_CONFIG',
    httpStatus: 503,
  },
  {
    nazwa: 'model nieznany dostawcy',
    err: new Error('The model `anthropic/claude-3-opus` does not exist'),
    errorCode: 'AI_CONFIG',
    httpStatus: 503,
  },
  {
    nazwa: '5xx po stronie dostawcy',
    err: Object.assign(new Error('Bad gateway from upstream'), { status: 502 }),
    errorCode: 'AI_UNAVAILABLE',
    httpStatus: 503,
  },
  {
    nazwa: 'wylacznik otwarty',
    err: Object.assign(new Error('Circuit [openrouter] is OPEN. Retry in 18s'), {
      code: 'CIRCUIT_OPEN',
    }),
    errorCode: 'AI_UNAVAILABLE',
    httpStatus: 503,
  },
  {
    nazwa: 'przekroczony czas',
    err: new Error('Request to https://openrouter.ai/api/v1/chat/completions timed out after 60000ms'),
    errorCode: 'AI_TIMEOUT',
    httpStatus: 504,
  },
  {
    nazwa: 'przerwany strumien',
    err: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
    errorCode: 'AI_STREAM_INTERRUPTED',
    httpStatus: 502,
  },
  {
    nazwa: 'nieudane odtworzenie przerwanej odpowiedzi',
    err: { code: 'PARTIAL_RECOVERY_UNAVAILABLE' },
    errorCode: 'AI_STREAM_INTERRUPTED',
    httpStatus: 502,
  },
  {
    nazwa: 'pusta odpowiedz',
    err: { code: 'EMPTY_STREAM' },
    errorCode: 'AI_EMPTY',
    httpStatus: 502,
  },
  {
    nazwa: 'blad nierozpoznany',
    err: new Error('something odd happened in the worker'),
    errorCode: 'AI_ERROR',
    httpStatus: 502,
  },
];

describe('providerErrorMapper — kazdy przypadek dostawcy ma kod i bezpieczny komunikat', () => {
  it.each(CASES)('$nazwa -> $errorCode / HTTP $httpStatus', ({ err, errorCode, httpStatus }) => {
    const mapped = mapProviderError(err);
    expect(mapped.errorCode).toBe(errorCode);
    expect(mapped.httpStatus).toBe(httpStatus);
    expect(mapped.safeMessage.length).toBeGreaterThan(10);
  });

  it('classifyProviderError zwraca ten sam kod co mapProviderError', () => {
    for (const c of CASES) {
      expect(classifyProviderError(c.err)).toBe(c.errorCode);
    }
  });

  it('kazdy przypadek daje inny errorCode niz zbiorczy AI_ERROR, poza jawnym nierozpoznanym', () => {
    const rozpoznane = CASES.filter((c) => c.errorCode !== 'AI_ERROR');
    expect(rozpoznane.length).toBe(CASES.length - 1);
    expect(new Set(rozpoznane.map((c) => c.errorCode)).size).toBe(6);
  });
});

describe('TEST NEGATYWNY — surowa tresc dostawcy nie moze wyjsc do klienta', () => {
  it('cialo HTTP nie zawiera niczego z surowego bledu', () => {
    for (const c of CASES) {
      const body = JSON.stringify(toSafeErrorBody(mapProviderError(c.err)));
      expect(
        looksLikeProviderDetail(body),
        `wyciek w ciele odpowiedzi dla przypadku „${c.nazwa}": ${body}`
      ).toBe(false);
    }
  });

  it('ramka SSE nie zawiera niczego z surowego bledu', () => {
    for (const c of CASES) {
      const frame = JSON.stringify(
        toSafeSseFrame(mapProviderError(c.err, { legacyCode: 'AI_STREAM_ERROR' }), {
          sessionId: 'sess-1',
          canResume: false,
        })
      );
      expect(
        looksLikeProviderDetail(frame),
        `wyciek w ramce SSE dla przypadku „${c.nazwa}": ${frame}`
      ).toBe(false);
    }
  });

  it('konkretne tokeny z bledow dostawcy nie pojawiaja sie w odpowiedzi', () => {
    const zakazane = [
      'sk-or-v1',
      'openrouter',
      'openrouter.ai',
      'gpt-4o-mini',
      'anthropic/claude-3-opus',
      'Circuit [openrouter]',
      '60000ms',
      'OPENROUTER_API_KEY',
      'llm_providers',
    ];
    for (const c of CASES) {
      const wire = JSON.stringify({
        body: toSafeErrorBody(mapProviderError(c.err)),
        frame: toSafeSseFrame(mapProviderError(c.err)),
      }).toLowerCase();
      for (const token of zakazane) {
        expect(wire.includes(token.toLowerCase()), `„${token}" wyciekl przy „${c.nazwa}"`).toBe(
          false
        );
      }
    }
  });

  it('surowa tresc JEST zachowana — ale tylko w logMessage (log serwera)', () => {
    const mapped = mapProviderError(new Error('Circuit [openrouter] is OPEN. Retry in 18s'));
    expect(mapped.logMessage).toContain('openrouter');
    expect(mapped.safeMessage).not.toContain('openrouter');
    expect(JSON.stringify(toSafeErrorBody(mapped))).not.toContain('openrouter');
  });

  it('bezpiecznik samego bezpiecznika: looksLikeProviderDetail wykrywa wyciek', () => {
    expect(looksLikeProviderDetail('Circuit [openrouter] is OPEN')).toBe(true);
    expect(looksLikeProviderDetail('Incorrect API key provided: sk-or-v1-9f3a')).toBe(true);
    expect(looksLikeProviderDetail('Set OPENROUTER_API_KEY')).toBe(true);
    expect(looksLikeProviderDetail('The assistant is temporarily unavailable.')).toBe(false);
  });
});

describe('zgodnosc wstecz kontraktu drutu', () => {
  it('legacyCode zostaje na drucie jako `code`, kanoniczny jako `errorCode`', () => {
    const frame = toSafeSseFrame(
      mapProviderError(new Error('boom'), { legacyCode: 'AI_STREAM_ERROR' })
    );
    expect(frame.code).toBe('AI_STREAM_ERROR');
    expect(frame.errorCode).toBe('AI_ERROR');
  });

  it('bez legacyCode uzywa kodu z bledu, a w ostatecznosci kanonicznego', () => {
    expect(mapProviderError({ code: 'CIRCUIT_OPEN' }).legacyCode).toBe('CIRCUIT_OPEN');
    expect(mapProviderError(new Error('boom')).legacyCode).toBe('AI_ERROR');
  });
});
