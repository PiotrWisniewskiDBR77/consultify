import { describe, expect, it } from 'vitest';
import settingsRegistryService from '../../../server/src/services/settingsRegistryService';

describe('SET-001 operational registry', () => {
  it('declares owner, scope, endpoint, storage, effect and secret rule for every control', () => {
    const registry = settingsRegistryService.getRegistry();
    expect(registry).toHaveLength(22);
    for (const control of registry) {
      expect(control.ownerContract).toMatch(/^P3[0-3]$/);
      expect(control.scope).toMatch(/^(personal|module|tenant)$/);
      expect(control.endpoint).toMatch(/^\/api\//);
      expect(control.storage).toBeTruthy();
      expect(control.observableEffect).toBeTruthy();
      expect(control.secretRule).toMatch(/^(NOT_SECRET|WRITE_ONLY_NEVER_RETURN)$/);
    }
  });

  it('keeps forced tenant policy outside writable personal settings', () => {
    for (const key of ['mfa_required', 'sso_enforced', 'guest_access_enabled']) {
      const meta = settingsRegistryService.getKeyMetadata(key)!;
      expect(meta.scope).toBe('tenant');
      expect(meta.readOnlyInSettings).toBe(true);
      expect(settingsRegistryService.getWriteTarget(key, 'member')).toBe('blocked');
    }
  });
});
