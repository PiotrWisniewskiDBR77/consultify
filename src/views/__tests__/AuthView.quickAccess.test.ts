import { describe, expect, it } from 'vitest';

import { isQuickAccessShortcutHost, resolveQuickAccessCredentials } from '../AuthView';

describe('AuthView staging quick access', () => {
  it('classifies the canonical demo domain as a non-production staging host', () => {
    expect(isQuickAccessShortcutHost('demo.consultify.ai')).toBe(true);
    expect(resolveQuickAccessCredentials('7777', 'demo.consultify.ai')).toEqual({
      email: 'piotr.wisniewski@dbr77.com',
      password: '123456',
    });
  });

  it('keeps non-demo consultify.ai subdomains outside the staging shortcut allowlist', () => {
    expect(isQuickAccessShortcutHost('evil.consultify.ai')).toBe(false);
    expect(resolveQuickAccessCredentials('7777', 'evil.consultify.ai')).toBeNull();
  });

  it('does not expand production access beyond the existing Anna shortcut', () => {
    expect(resolveQuickAccessCredentials('7777', 'consultify.ai')).toBeNull();
    expect(resolveQuickAccessCredentials('1111', 'consultify.ai')).toEqual({
      email: 'anna.zielinska@ateliertoys-demo.com',
      password: '123456',
    });
  });
});
