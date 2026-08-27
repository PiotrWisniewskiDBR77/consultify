/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

vi.mock('../../src/services/api', () => ({
  API_URL: 'https://api.example.test',
  Api: {
    login: vi.fn(),
    demoLogin: vi.fn(),
    register: vi.fn(),
    registerDemo: vi.fn(),
  },
}));

import { isQuickAccessEnabledHost, resolveQuickAccessCredentials } from '../../src/views/AuthView';

const configuredEnv = {
  VITE_QUICK_ACCESS_MAP: JSON.stringify({
    '9999': { email: 'test@localhost', password: 'local-only' },
    '8888': { demo: true },
  }),
};

describe('AuthView quick access guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('keeps the shortcut panel inactive without build-time configuration', () => {
    expect(isQuickAccessEnabledHost('localhost', {})).toBe(false);
    expect(isQuickAccessEnabledHost('demo.consultify.ai', {})).toBe(false);
    expect(isQuickAccessEnabledHost('consultify.ai', {})).toBe(false);
  });

  it('enables configured local and staging hosts', () => {
    expect(isQuickAccessEnabledHost('localhost', configuredEnv)).toBe(true);
    expect(isQuickAccessEnabledHost('127.0.0.1', configuredEnv)).toBe(true);
    expect(isQuickAccessEnabledHost('stage.consultify.ai', configuredEnv)).toBe(true);
    expect(isQuickAccessEnabledHost('app.consultify.com', configuredEnv)).toBe(true);
  });

  it('keeps arbitrary and public production hosts blocked independently of the map', () => {
    expect(isQuickAccessEnabledHost('evil.example.com', configuredEnv)).toBe(false);
    expect(isQuickAccessEnabledHost('consultify.ai', configuredEnv)).toBe(false);
    expect(resolveQuickAccessCredentials('9999', 'evil.example.com', configuredEnv)).toBeNull();
    expect(resolveQuickAccessCredentials('9999', 'consultify.ai', configuredEnv)).toBeNull();
  });

  it('resolves configured credentials and demo entries on localhost', () => {
    expect(resolveQuickAccessCredentials('9999', 'localhost', configuredEnv)).toEqual({
      email: 'test@localhost',
      password: 'local-only',
    });
    expect(resolveQuickAccessCredentials('8888', 'localhost', configuredEnv)).toEqual({
      demo: true,
    });
  });
});
