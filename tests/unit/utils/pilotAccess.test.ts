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
  // Pilot scope (SSOT: src/utils/pilotAccess.ts) = Chat + Interview + My Work
  // (Ideas tab stays locked) + Initiatives + Execution + Settings. Anything
  // outside that set is denied. Keep these assertions in lock-step with
  // PILOT_ALLOWED_ROUTE_PREFIXES / PILOT_VISIBLE_MENU_IDS.
  it('allows only the pilot routes', () => {
    // In-scope prefixes.
    expect(isPilotAllowedPath('/chat')).toBe(true);
    expect(isPilotAllowedPath('/interview')).toBe(true);
    expect(isPilotAllowedPath('/settings')).toBe(true);
    expect(isPilotAllowedPath('/share/abc')).toBe(true);
    expect(isPilotAllowedPath('/my-work')).toBe(true);
    expect(isPilotAllowedPath('/initiatives')).toBe(true);
    expect(isPilotAllowedPath('/execution')).toBe(true);
    expect(isPilotAllowedPath('/implementation')).toBe(true);
    // Out-of-scope modules stay denied.
    expect(isPilotAllowedPath('/finance')).toBe(false);
    expect(isPilotAllowedPath('/wordy')).toBe(false);
  });

  it('filters sidebar entries and internal tabs for pilot participants', () => {
    expect(isPilotAllowedMenuId('AI_CHAT')).toBe(true);
    expect(isPilotAllowedMenuId('INTERVIEW')).toBe(true);
    expect(isPilotAllowedMenuId('MY_WORK')).toBe(true);
    expect(isPilotAllowedMenuId('MODULE_INITIATIVES')).toBe(true);
    expect(isPilotAllowedMenuId('MODULE_EXECUTION')).toBe(true);
    // Out-of-scope modules stay hidden for pilot participants.
    expect(isPilotAllowedMenuId('MODULE_WORDY')).toBe(false);
    expect(isPilotAllowedMenuId('MODULE_ECONOMICS')).toBe(false);
    // My Work is in scope, but the Ideas tab itself stays locked.
    expect(isPilotAllowedMyWorkTab('ideas')).toBe(false);
    expect(isPilotAllowedMyWorkTab('tasks')).toBe(true);
    expect(isPilotAllowedMyWorkTab('notebook')).toBe(true);
    expect(isPilotAllowedMyWorkTab('decisions')).toBe(true);
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
