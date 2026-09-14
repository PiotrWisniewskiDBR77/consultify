/**
 * PILOT-A — sonda zdrowia NIE otwiera produkcyjnego bezpiecznika.
 *
 * Zmierzone na stagingu 2026-09-14: panel zdrowia dostawcow odswieza sie co
 * ~5 min i wola `llmService.testConnection`. `openai` ("You have no credits
 * remaining") i `deepseek` ("Insufficient Balance") byly bez srodkow, wiec
 * KAZDE odswiezenie zapisywalo porazke na WSPOLDZIELONYM bezpieczniku i
 * otwieralo go dla realnego ruchu:
 *   03:42:41  Circuit [openai] OPENED after 11 failures
 *   03:48:20  Circuit [openai] OPENED after 12 failures
 *   03:53:27  Circuit [openai] OPENED after 13 failures
 * Przyrzad psul produkt.
 *
 * Test NEGATYWNY (broni zabezpieczenia, nie mechanizmu): przywrocenie
 * `circuitBreaker.recordFailure(...)` w `testConnection` natychmiast czerwieni
 * kazdy z trzech przypadkow. Sukces sondy nadal wolno leczyc (`recordSuccess`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordFailure = vi.fn(async () => undefined);
const recordSuccess = vi.fn(async () => undefined);

vi.mock('../circuitBreaker.js', () => ({
  default: {
    recordFailure,
    recordSuccess,
    canExecute: vi.fn(async () => ({ allowed: true, state: 'CLOSED' })),
    getStatus: vi.fn(() => ({})),
    reset: vi.fn(async () => undefined),
    execute: vi.fn(),
  },
}));

const originalFetch = globalThis.fetch;

describe('PILOT-A: testConnection nie otwiera bezpiecznika', () => {
  beforeEach(() => {
    recordFailure.mockClear();
    recordSuccess.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('openai bez srodkow (402/insufficient_quota) — zero zapisow porazki', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            message:
              'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
            code: 'insufficient_quota',
            type: 'insufficient_quota',
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const { llmService } = await import('../llmService.js');
    const wynik: any = await llmService.testConnection({
      provider: 'openai',
      apiKey: 'sk-test-pilot-a',
      id: 'gpt-4o-mini',
      timeoutMs: 1000,
    } as any);

    expect(wynik.success).toBe(false);
    expect(String(wynik.error)).toContain('no credits remaining');
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('openrouter 401 — zero zapisow porazki', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'User not found.' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const { llmService } = await import('../llmService.js');
    const wynik: any = await llmService.testConnection({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-test-pilot-a',
      id: 'openai/gpt-4o-mini',
      timeoutMs: 1000,
    } as any);

    expect(wynik.success).toBe(false);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('sciezka wyjatku (deepseek — brak salda / timeout) — zero zapisow porazki', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Insufficient Balance');
    }) as unknown as typeof fetch;

    const { llmService } = await import('../llmService.js');
    const wynik: any = await llmService.testConnection({
      provider: 'deepseek',
      apiKey: 'sk-test-pilot-a',
      id: 'deepseek-chat',
      timeoutMs: 1000,
    } as any);

    expect(wynik.success).toBe(false);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('udana sonda nadal LECZY bezpiecznik (recordSuccess zostaje)', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const { llmService } = await import('../llmService.js');
    const wynik: any = await llmService.testConnection({
      provider: 'openai',
      apiKey: 'sk-test-pilot-a',
      id: 'gpt-4o-mini',
      timeoutMs: 1000,
    } as any);

    expect(wynik.success).toBe(true);
    expect(recordSuccess).toHaveBeenCalledWith('openai');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
