/**
 * RN-G6 P0 fix (F1) regression coverage — `src/services/apiUtils.ts`'s
 * module-scope correlation-id generator/loader.
 *
 * Root cause this guards against: the previous generator
 * (`Math.random().toString(36)...`) produced a non-UUID token that flowed,
 * via `X-Correlation-ID`, into a Postgres `UUID NOT NULL` column
 * (`rvn_platform_events.correlation_id`) and crashed every KPI/ROI/OKR write
 * with a 500 on a fresh browser session. See `apiUtils.ts`'s own header
 * comment and `server/src/routes/resultsVnext/correlationId.ts` for the full
 * writeup (client + server defense in depth).
 *
 * The module computes `correlationId` at IMPORT TIME (module scope, not
 * inside a function) — every test therefore needs `vi.resetModules()` plus a
 * fresh dynamic `import()` AFTER seeding `sessionStorage`, same pattern
 * `tokenService.stability.test.ts` uses for the same reason.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('apiUtils correlation id (RN-G6 P0 fix — F1)', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  it('mints a real UUID when sessionStorage has no stored value', async () => {
    expect(sessionStorage.getItem('correlationId')).toBeNull();

    const { getHeaders } = await import('@/services/apiUtils');
    const headers = getHeaders();

    expect(headers['X-Correlation-ID']).toMatch(UUID_RE);
    expect(sessionStorage.getItem('correlationId')).toBe(headers['X-Correlation-ID']);
  });

  it('reuses an already-valid stored UUID instead of minting a new one', async () => {
    const existing = '4d60dfca-1111-4aaa-8bbb-000000000001';
    sessionStorage.setItem('correlationId', existing);

    const { getHeaders } = await import('@/services/apiUtils');
    const headers = getHeaders();

    expect(headers['X-Correlation-ID']).toBe(existing);
    expect(sessionStorage.getItem('correlationId')).toBe(existing);
  });

  it('discards a pre-existing, invalid value (the exact shape the old bug produced) and mints a real UUID', async () => {
    // Reproduces the OLD generator's output shape exactly:
    // Math.random().toString(36).substring(2, 15) x2 — this is what was
    // already sitting in sessionStorage for any tab open before the fix.
    const staleInvalidValue =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('correlationId', staleInvalidValue);
    expect(staleInvalidValue).not.toMatch(UUID_RE);

    const { getHeaders } = await import('@/services/apiUtils');
    const headers = getHeaders();

    expect(headers['X-Correlation-ID']).toMatch(UUID_RE);
    expect(headers['X-Correlation-ID']).not.toBe(staleInvalidValue);
    expect(sessionStorage.getItem('correlationId')).toBe(headers['X-Correlation-ID']);
  });

  it('discards an empty-string stored value and mints a real UUID', async () => {
    sessionStorage.setItem('correlationId', '');

    const { getHeaders } = await import('@/services/apiUtils');
    const headers = getHeaders();

    expect(headers['X-Correlation-ID']).toMatch(UUID_RE);
  });

  it('every header call within one module load returns the SAME correlation id (stable per session)', async () => {
    const { getHeaders } = await import('@/services/apiUtils');
    const first = getHeaders()['X-Correlation-ID'];
    const second = getHeaders()['X-Correlation-ID'];

    expect(first).toBe(second);
  });
});
