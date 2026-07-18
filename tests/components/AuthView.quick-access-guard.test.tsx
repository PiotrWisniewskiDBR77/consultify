/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
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

import {
  isQuickAccessEnabledHost,
  resolveQuickAccessCredentials,
} from '../../src/views/AuthView';

describe('AuthView quick access guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('enables shortcut panel on public production hosts', () => {
    expect(isQuickAccessEnabledHost('consultify.ai')).toBe(true);
    expect(isQuickAccessEnabledHost('www.consultify.ai')).toBe(true);
  });

  it('keeps shortcut panel off arbitrary external domains', () => {
    expect(isQuickAccessEnabledHost('evil.example.com')).toBe(false);
  });

  it('keeps quick access available on local and staging hosts', () => {
    expect(isQuickAccessEnabledHost('localhost')).toBe(true);
    expect(isQuickAccessEnabledHost('127.0.0.1')).toBe(true);
    expect(isQuickAccessEnabledHost('stage.consultify.ai')).toBe(true);
    expect(isQuickAccessEnabledHost('staging.consultify.app')).toBe(true);
    expect(isQuickAccessEnabledHost('app.consultify.com')).toBe(true);
  });

  it('on production public host only 1111 resolves (Anna demo)', () => {
    expect(resolveQuickAccessCredentials('1111', 'consultify.ai')).toEqual({
      email: 'anna.zielinska@ateliertoys-demo.com',
      password: '123456',
    });
    expect(resolveQuickAccessCredentials('7777', 'consultify.ai')).toBeNull();
    expect(resolveQuickAccessCredentials('7776', 'www.consultify.ai')).toBeNull();
  });

  it('on localhost dev/staging PINs include legacy codes and 1111', () => {
    expect(resolveQuickAccessCredentials('7777', 'localhost')).toMatchObject({
      email: 'piotr.wisniewski@dbr77.com',
    });
    expect(resolveQuickAccessCredentials('7778', 'localhost')).toEqual({ demo: true });
    expect(resolveQuickAccessCredentials('1111', 'localhost')).toMatchObject({
      email: 'anna.zielinska@ateliertoys-demo.com',
    });
  });
});
