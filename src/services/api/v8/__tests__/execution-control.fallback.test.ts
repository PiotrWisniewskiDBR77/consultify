import { describe, expect, it } from 'vitest';

import { shouldFallbackToLegacyExecutionControl } from '../execution-control';

describe('Execution control fallback contract', () => {
  it.each([400, 404, 405, 409, 500, 501])(
    'does not reinterpret HTTP %s as permission to read legacy truth',
    (status) => {
      expect(
        shouldFallbackToLegacyExecutionControl({
          status,
          data: { error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_FAILED' } },
        })
      ).toBe(false);
    }
  );

  it('allows only an explicit server capability-unavailable contract', () => {
    expect(
      shouldFallbackToLegacyExecutionControl({
        status: 501,
        data: { error: { code: 'EXECUTION_CONTROL_CAPABILITY_UNAVAILABLE' } },
      })
    ).toBe(true);
    expect(
      shouldFallbackToLegacyExecutionControl({
        status: 404,
        data: { error: { code: 'EXECUTION_CONTROL_CAPABILITY_UNAVAILABLE' } },
      })
    ).toBe(false);
  });
});
