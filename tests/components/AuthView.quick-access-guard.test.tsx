/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
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

import { isQuickAccessEnabledHost } from '../../src/views/AuthView';

describe('AuthView quick access guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('disables quick access on production hosts', () => {
    expect(isQuickAccessEnabledHost('consultify.ai')).toBe(false);
    expect(isQuickAccessEnabledHost('app.consultify.ai')).toBe(false);
  });

  it('keeps quick access available on local and staging hosts', () => {
    expect(isQuickAccessEnabledHost('localhost')).toBe(true);
    expect(isQuickAccessEnabledHost('127.0.0.1')).toBe(true);
    expect(isQuickAccessEnabledHost('stage.consultify.ai')).toBe(true);
  });
});
