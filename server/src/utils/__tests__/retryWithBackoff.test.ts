/**
 * retryWithBackoff — fala sprzątania 1b (2026-07-27).
 *
 * Generic in-process retry helper backing the artifact-registration
 * hardening in document-studio.routes.ts / workbook.routes.ts (see those
 * files' `registerGeneratedDocumentOrigin` / sheet registration call sites).
 */

import { describe, expect, it, vi } from 'vitest';

import { retryWithBackoff } from '../retryWithBackoff.js';

describe('retryWithBackoff', () => {
  it('returns the result on the first successful attempt without retrying', async () => {
    const fn = vi.fn(async () => 'ok');
    const onAttemptFailed = vi.fn();

    const result = await retryWithBackoff(fn, { onAttemptFailed, baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAttemptFailed).not.toHaveBeenCalled();
  });

  it('retries after a failure and succeeds on a later attempt', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error(`fail-${calls}`);
      return 'recovered';
    });
    const onAttemptFailed = vi.fn();

    const result = await retryWithBackoff(fn, { attempts: 3, baseDelayMs: 1, onAttemptFailed });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onAttemptFailed).toHaveBeenCalledTimes(2);
    expect(onAttemptFailed).toHaveBeenNthCalledWith(1, 1, 3, expect.any(Error));
    expect(onAttemptFailed).toHaveBeenNthCalledWith(2, 2, 3, expect.any(Error));
  });

  it('throws the last error once every attempt is exhausted', async () => {
    const fn = vi.fn(async () => {
      throw new Error('permanent failure');
    });

    await expect(retryWithBackoff(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow(
      'permanent failure'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('defaults to 3 attempts when no options are given', async () => {
    const fn = vi.fn(async () => {
      throw new Error('nope');
    });

    await expect(retryWithBackoff(fn)).rejects.toThrow('nope');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('never retries below 1 attempt even if attempts is set to 0', async () => {
    const fn = vi.fn(async () => {
      throw new Error('single shot');
    });

    await expect(retryWithBackoff(fn, { attempts: 0, baseDelayMs: 1 })).rejects.toThrow(
      'single shot'
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
