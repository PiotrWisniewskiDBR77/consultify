import { describe, expect, it } from 'vitest';

import {
  buildOnboardingWizardSnapshot,
  normalizeOnboardingPersona,
  restoreOnboardingWizardState,
} from '@/views/onboardingWizardRuntime';

describe('onboardingWizardRuntime', () => {
  it('normalizes common personas from free-form role text', () => {
    expect(normalizeOnboardingPersona('VP Finance / CFO')).toBe('CFO');
    expect(normalizeOnboardingPersona('Security Lead / CISO')).toBe('CISO');
    expect(normalizeOnboardingPersona('Partner Manager')).toBe('Partner');
    expect(normalizeOnboardingPersona('Program Manager')).toBe('Transformation Officer');
  });

  it('round-trips wizard state through snapshot currentDraft', () => {
    const snapshot = buildOnboardingWizardSnapshot(
      {
        context: {
          role: 'CFO',
          industry: 'Fintech',
          problems: 'Reporting takes too long',
          urgency: 'High',
          targets: 'Cut prep time by 50%',
        },
        step: 3,
        plan: {
          plan_title: 'Finance acceleration',
          suggested_initiatives: [{ id: 'init-1', title: 'Automate reporting' }],
        },
        selectedInitiativeIds: ['init-1'],
        trustViewedAt: '2026-04-23T10:00:00.000Z',
        trustAcknowledged: true,
        selectedPersona: 'CFO',
        personaConfidence: 'high',
        personaConfirmed: true,
        adminConsoleAcknowledged: true,
      },
      'CFO'
    );

    const restored = restoreOnboardingWizardState(snapshot, {
      role: '',
      industry: '',
      problems: '',
      urgency: 'Normal',
      targets: '',
    });

    expect(restored).toEqual(
      expect.objectContaining({
        step: 3,
        selectedInitiativeIds: ['init-1'],
        context: expect.objectContaining({
          role: 'CFO',
          industry: 'Fintech',
        }),
        trustAcknowledged: true,
        selectedPersona: 'CFO',
        personaConfirmed: true,
        plan: expect.objectContaining({
          plan_title: 'Finance acceleration',
        }),
      })
    );
  });
});
