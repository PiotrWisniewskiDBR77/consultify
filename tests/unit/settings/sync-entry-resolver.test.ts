import { describe, expect, it } from 'vitest';

import {
  normalizeSettingsSectionFromPath,
  resolveLegacySyncSettingsEntry,
} from '../../../src/views/settings/syncEntryResolver';

describe('sync settings entry resolver', () => {
  it('redirects admin legacy sync settings entry to the admin integrations hub', () => {
    expect(resolveLegacySyncSettingsEntry('/settings/integrations', 'ADMIN')).toBe(
      '/admin?tab=integrations',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/integrations/', 'SUPER_ADMIN')).toBe(
      '/admin?tab=integrations',
    );
  });

  it('redirects non-admin legacy sync settings entry to connected apps', () => {
    expect(resolveLegacySyncSettingsEntry('/settings/integrations', 'USER')).toBe(
      '/settings/connected-apps',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/profile', 'USER')).toBeNull();
  });

  it('normalizes the legacy integrations section to connected-apps', () => {
    expect(normalizeSettingsSectionFromPath('/settings/integrations')).toBe('connected-apps');
    expect(normalizeSettingsSectionFromPath('/settings/connected-apps')).toBe('connected-apps');
    expect(normalizeSettingsSectionFromPath('/settings/profile')).toBe('profile');
  });
});
