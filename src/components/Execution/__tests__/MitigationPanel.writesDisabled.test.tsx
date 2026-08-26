/**
 * @vitest-environment jsdom
 *
 * DEC-120/A11 — MitigationPanel.updateRaidMitigation posts through
 * V8ExecutionControlApi.updateRaidMitigation → PATCH
 * /api/v8/execution-control/raid/:id/mitigation, which
 * requireCanonicalExecutionWriter 409s unconditionally (only the budget-entry
 * DELETE exception is exempt). The Save button must render disabled with a
 * visible reason, never as an active control that always ends in a 409.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => (typeof opts === 'string' ? opts : (opts?.defaultValue ?? k)),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { updateRaidMitigation } = vi.hoisted(() => ({ updateRaidMitigation: vi.fn() }));
vi.mock('@/services/api/v8/execution-control', () => ({
  shouldFallbackToLegacyExecutionControl: () => false,
  V8ExecutionControlApi: { updateRaidMitigation },
}));

import { MitigationPanel } from '../MitigationPanel';

describe('MitigationPanel — writes disabled (DEC-120/A11)', () => {
  it('renders the Save button disabled with a visible reason', () => {
    render(<MitigationPanel raidItemId="raid-1" />);

    const saveButton = screen.getByRole('button', { name: /execution\.mitigation\.save/ });
    expect(saveButton).toBeDisabled();
    expect(
      screen.getByText('Saving is moving to the canonical execution registry — in progress')
    ).toBeInTheDocument();
  });

  it('never calls the retired legacy writer since the control cannot be activated', () => {
    render(<MitigationPanel raidItemId="raid-1" />);
    const saveButton = screen.getByRole('button', { name: /execution\.mitigation\.save/ });
    // A disabled button ignores click events in jsdom the same as real browsers.
    saveButton.click();
    expect(updateRaidMitigation).not.toHaveBeenCalled();
  });
});
