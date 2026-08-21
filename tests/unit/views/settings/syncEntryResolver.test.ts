import { describe, expect, it } from 'vitest';

import {
  normalizeSettingsSectionFromPath,
  resolveLegacySyncSettingsEntry,
} from '../../../../src/views/settings/syncEntryResolver';

describe('syncEntryResolver', () => {
  it('redirects legacy settings entrypoints to mounted canonical surfaces', () => {
    expect(resolveLegacySyncSettingsEntry('/settings/ai', 'MEMBER')).toBe('/settings/ai-behavior');
    expect(resolveLegacySyncSettingsEntry('/settings/notifications', 'MEMBER')).toBe(
      '/settings/notifications-overview',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/security', 'MEMBER')).toBe(
      '/settings/security-dashboard',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/organization', 'ADMIN')).toBe(
      '/settings/tenant-defaults',
    );
  });

  it('routes legacy billing and integrations based on ownership role', () => {
    expect(resolveLegacySyncSettingsEntry('/settings/billing', 'ADMIN')).toBe(
      '/admin/billing/overview',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/billing', 'OWNER')).toBe(
      '/admin/billing/overview',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/billing', 'MEMBER')).toBe('/settings/profile');
    expect(resolveLegacySyncSettingsEntry('/settings/integrations', 'ADMIN')).toBe(
      '/admin/integrations',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/integrations', 'OWNER')).toBe(
      '/admin/integrations',
    );
    expect(resolveLegacySyncSettingsEntry('/settings/integrations', 'MEMBER')).toBe(
      '/settings/connected-apps',
    );
  });

  it('keeps mounted settings slugs stable', () => {
    expect(normalizeSettingsSectionFromPath('/settings/security-dashboard')).toBe(
      'security-dashboard',
    );
    expect(normalizeSettingsSectionFromPath('/settings/notifications-overview')).toBe(
      'notifications-overview',
    );
    expect(normalizeSettingsSectionFromPath('/settings/ai-behavior')).toBe('ai-behavior');
    expect(normalizeSettingsSectionFromPath('/settings/ai-history')).toBe('ai-chat-history');
  });
});
