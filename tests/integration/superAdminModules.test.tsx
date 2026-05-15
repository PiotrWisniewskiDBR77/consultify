/**
 * L1: SuperAdmin section surface (honest)
 *
 * Ensures the sidebar mapping exposes all supported sections.
 */

import { describe, expect, it } from 'vitest';

import { appViewToSection, sectionToAppView } from '../../src/components/layout/SuperAdminSidebar';

describe('SuperAdmin sections', () => {
  it('exposes expected sections', () => {
    const keys = Object.keys(sectionToAppView).sort();
    expect(keys).toEqual(['ai-platform', 'content', 'customers', 'security', 'system']);
  });

  it('maps deep-link app views back to the canonical live sections', () => {
    expect(appViewToSection.SUPERADMIN_AI_CONFIG).toBe('ai-platform');
    expect(appViewToSection.SUPERADMIN_PLAYBOOK_EDITOR).toBe('customers');
    expect(appViewToSection.SUPERADMIN_VIRTUAL_WORKERS).toBe('ai-platform');
    expect(appViewToSection.SUPERADMIN_WHITELABEL).toBe('system');
  });
});
