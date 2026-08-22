import { describe, expect, it } from 'vitest';

import {
  initiativeLoadErrorCode,
  isInitiativesNetworkError,
} from '../../../src/components/Initiatives/initiativeLoadError';

describe('Initiatives load error classification', () => {
  it('retries only genuine fetch transport failures', () => {
    expect(isInitiativesNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(
      isInitiativesNetworkError(
        new TypeError("Cannot read properties of undefined (reading 'freshness')")
      )
    ).toBe(false);
    expect(isInitiativesNetworkError({ message: 'Failed to fetch' })).toBe(false);
  });

  it('preserves server codes and labels local contract failures honestly', () => {
    expect(initiativeLoadErrorCode({ data: { code: 'INITIATIVE_NOT_FOUND' } })).toBe(
      'INITIATIVE_NOT_FOUND'
    );
    expect(
      initiativeLoadErrorCode(
        new TypeError("Cannot read properties of undefined (reading 'freshness')")
      )
    ).toBe('INITIATIVE_DATA_CONTRACT_ERROR');
    expect(initiativeLoadErrorCode(new TypeError('Failed to fetch'))).toBe('NETWORK_ERROR');
  });
});
