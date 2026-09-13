import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../../src/services/api';
describe('actual API error message and envelope preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('nested audit failure is readable through actual API call', async () => {
    const payload = {
      error: { message: 'Audit data unavailable' },
      code: 'AUDIT_UNAVAILABLE',
      correlationId: 'audit-probe',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 500 }))
    );
    const error = await Api.getTenantAdminAuditLogs().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Audit data unavailable');
    expect(error.errorCode).toBe('AUDIT_UNAVAILABLE');
    expect(error.correlationId).toBe('audit-probe');
    expect(error.status).toBe(500);
    expect(error.data).toEqual(payload);
  });
  it('preserves plain message and lifecycle rule envelope', () => {
    const payload = {
      error: 'A current GO decision is required',
      rule: 'GATE_DECISION_REQUIRED',
      correlationId: 'rule-probe',
    };
    const error = new ApiError(payload, 'Fallback', 400);
    expect(error.message).toBe(payload.error);
    expect(error.errorCode).toBe(payload.rule);
    expect(error.data).toBe(payload);
    expect(error.status).toBe(400);
  });
  it('preserves explicit errorCode priority', () => {
    const error = new ApiError(
      { message: 'Conflict', errorCode: 'EXPLICIT', code: 'SECOND', rule: 'THIRD' },
      'Fallback',
      409
    );
    expect(error.errorCode).toBe('EXPLICIT');
    expect(error.message).toBe('Conflict');
  });
  it('unknown object error falls back without object coercion', () => {
    expect(new ApiError({ error: { unexpected: true } }, 'Audit unavailable', 500).message).toBe(
      'Audit unavailable'
    );
  });
  it('nested database failure uses English fallback before translations load', async () => {
    const payload = {
      error: {
        code: 'DATABASE_ERROR',
        message:
          'Nie udało się odczytać danych. Spróbuj ponownie lub zgłoś identyfikator korelacji.',
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 500 }))
    );
    const error = await Api.getTenantAdminAuditLogs().catch((e: unknown) => e);
    expect(error.message).toBe('Data could not be loaded. Please try again.');
    expect(error.data).toEqual(payload);
  });
});
