/**
 * L1: SuperAdmin AI module mapping (honest)
 *
 * Validates the real mapping tables used by the UI (no fake routing strings).
 */

import { describe, expect, it } from 'vitest';

import { appViewToSection, sectionToAppView } from '../../src/components/layout/SuperAdminSidebar';
import { AppView } from '../../src/types';

describe('SuperAdminSidebar AI mappings', () => {
  it('the canonical AI section maps to the unified AI Platform view', () => {
    expect(sectionToAppView['ai-platform']).toBe(AppView.SUPERADMIN_AI_PLATFORM);
    expect(appViewToSection[AppView.SUPERADMIN_AI_INFRASTRUCTURE]).toBe('ai-platform');
    expect(appViewToSection[AppView.SUPERADMIN_AI_DEVELOPMENT]).toBe('ai-platform');
    expect(appViewToSection[AppView.SUPERADMIN_AI_OPERATIONS]).toBe('ai-platform');
  });

  it('legacy AppView routes redirect to ai-platform section', () => {
    expect(appViewToSection[AppView.SUPERADMIN_AI_PLATFORM]).toBe('ai-platform');
    expect(appViewToSection[AppView.SUPERADMIN_LLM_MANAGEMENT]).toBe('ai-platform');
    expect(appViewToSection[AppView.SUPERADMIN_AI_INTELLIGENCE]).toBe('ai-platform');
    expect(appViewToSection[AppView.SUPERADMIN_KNOWLEDGE]).toBe('ai-platform');
  });
});
