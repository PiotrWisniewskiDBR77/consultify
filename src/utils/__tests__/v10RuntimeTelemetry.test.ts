import { describe, expect, it } from 'vitest';

import { inferFailReason } from '../v10/v10RuntimeTelemetry';

describe('v10RuntimeTelemetry', () => {
  it('maps 404 responses to not_found', () => {
    expect(inferFailReason({ enabled: true, httpStatus: 404 })).toBe('not_found');
  });

  it('maps 501 responses to not_implemented', () => {
    expect(inferFailReason({ enabled: true, httpStatus: 501 })).toBe('not_implemented');
  });

  it('maps 503 responses to server_error', () => {
    expect(inferFailReason({ enabled: true, httpStatus: 503 })).toBe('server_error');
  });
});
