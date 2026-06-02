import { describe, expect, it } from 'vitest';

import {
  getPilotBlockedFallbackPath,
  getPilotDefaultSettingsRoute,
  isPilotAllowedArtifactType,
  isPilotAllowedMenuId,
  isPilotAllowedMyWorkTab,
  isPilotAllowedPath,
  isPilotAllowedSettingsSection,
} from '../../../src/utils/pilotAccess';

describe('pilotAccess', () => {
  it('allows only the pilot routes', () => {
    expect(isPilotAllowedPath('/chat')).toBe(true);
    expect(isPilotAllowedPath('/interview')).toBe(true);
    expect(isPilotAllowedPath('/settings')).toBe(true);
    expect(isPilotAllowedPath('/share/abc')).toBe(true);
    expect(isPilotAllowedPath('/my-work')).toBe(false);
    expect(isPilotAllowedPath('/initiatives')).toBe(false);
    expect(isPilotAllowedPath('/implementation')).toBe(false);
    expect(isPilotAllowedPath('/finance')).toBe(false);
    expect(isPilotAllowedPath('/wordy')).toBe(false);
  });

  it('filters sidebar entries and internal tabs for pilot participants', () => {
    expect(isPilotAllowedMenuId('AI_CHAT')).toBe(true);
    expect(isPilotAllowedMenuId('INTERVIEW')).toBe(true);
    expect(isPilotAllowedMenuId('MODULE_EXECUTION')).toBe(false);
    expect(isPilotAllowedMenuId('MODULE_WORDY')).toBe(false);
    expect(isPilotAllowedMyWorkTab('ideas')).toBe(false);
    expect(isPilotAllowedMyWorkTab('tasks')).toBe(true);
  });

  it('keeps only minimal settings sections available', () => {
    expect(getPilotDefaultSettingsRoute()).toBe('/settings/profile');
    expect(isPilotAllowedSettingsSection('profile')).toBe(true);
    expect(isPilotAllowedSettingsSection('auth-access')).toBe(true);
    expect(isPilotAllowedSettingsSection('theme')).toBe(true);
    expect(isPilotAllowedSettingsSection('ai-behavior')).toBe(false);
    expect(getPilotBlockedFallbackPath('/settings/ai-behavior')).toBe('/settings/profile');
  });

  it('blocks non-pilot artifact deep links', () => {
    expect(isPilotAllowedArtifactType('insight')).toBe(true);
    expect(isPilotAllowedArtifactType('task')).toBe(false);
    expect(isPilotAllowedArtifactType('initiative')).toBe(false);
    expect(isPilotAllowedArtifactType('idea')).toBe(false);
    expect(isPilotAllowedArtifactType('report')).toBe(false);
  });
});
