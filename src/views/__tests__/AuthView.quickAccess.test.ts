import { describe, expect, it } from 'vitest';

import { readQuickAccessMap } from '../../config/quickAccess';
import { isQuickAccessShortcutHost, resolveQuickAccessCredentials } from '../AuthView';

const syntheticMap = JSON.stringify({
  '9999': { email: 'test@localhost', password: 'local-only' },
  '8888': { demo: true },
});

describe('AuthView staging quick access', () => {
  it('is inactive when the build-time map is absent', () => {
    expect(resolveQuickAccessCredentials('9999', 'localhost', {})).toBeNull();
    expect(resolveQuickAccessCredentials('9999', 'demo.consultify.ai', {})).toBeNull();
    expect(resolveQuickAccessCredentials('9999', 'consultify.ai', {})).toBeNull();
  });

  it('resolves a synthetic entry on an allowed non-production host', () => {
    expect(
      resolveQuickAccessCredentials('9999', 'demo.consultify.ai', {
        VITE_QUICK_ACCESS_MAP: syntheticMap,
      })
    ).toEqual({ email: 'test@localhost', password: 'local-only' });
  });

  it('keeps arbitrary and public production hosts outside configured account access', () => {
    const env = { VITE_QUICK_ACCESS_MAP: syntheticMap };
    expect(isQuickAccessShortcutHost('evil.consultify.ai')).toBe(false);
    expect(resolveQuickAccessCredentials('9999', 'evil.consultify.ai', env)).toBeNull();
    expect(resolveQuickAccessCredentials('9999', 'consultify.ai', env)).toBeNull();
  });

  it('rejects malformed maps and entries without throwing', () => {
    expect(readQuickAccessMap({ VITE_QUICK_ACCESS_MAP: 'not-json' })).toEqual({});
    expect(readQuickAccessMap({ VITE_QUICK_ACCESS_MAP: JSON.stringify([]) })).toEqual({});
    expect(
      readQuickAccessMap({
        VITE_QUICK_ACCESS_MAP: JSON.stringify({
          '999': { email: 'test@localhost', password: 'local-only' },
          '9999': { email: '', password: 'local-only' },
        }),
      })
    ).toEqual({});
  });
});
