/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-037 — the canonical Initiative Wizard dialog must expose a
 * named dialog role, take focus on open, close on Escape, and return focus
 * to the trigger. Close-button naming is locale-dependent (PL/EN).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Overrides the global tests/setup.ts react-i18next mock: WizardStepper (the
// shared step indicator this dialog renders) calls `i18n.getFixedT(...)`,
// which the global mock doesn't provide.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultOrOpts?: any) =>
      typeof defaultOrOpts === 'string' ? defaultOrOpts : (defaultOrOpts?.defaultValue ?? key),
    i18n: {
      language: 'en',
      getFixedT: () => (key: string) => key,
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    getProjects: vi.fn(async () => []),
  },
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    listInsights: vi.fn(async () => ({ insights: [] })),
  },
}));

vi.mock('@/services/initiativeWriteTruth', () => ({
  createInitiativeWriteTruth: vi.fn(async () => ({ createdId: null, truth: {} })),
}));

vi.mock('@/utils/initiativeDuplicateDetection', () => ({
  checkDuplicateInitiative: vi.fn(() => null),
}));

import { InitiativeWizardModal } from '../InitiativeWizardModal';

const Harness: React.FC<{ language: 'pl' | 'en' }> = ({ language }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open wizard
      </button>
      <InitiativeWizardModal
        isOpen={open}
        existingInitiatives={[]}
        language={language}
        onClose={() => setOpen(false)}
        onCreated={() => {}}
      />
    </div>
  );
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('InitiativeWizardModal — dialog accessible contract', () => {
  it('exposes a dialog named "AI Initiative Wizard" (EN)', async () => {
    render(<Harness language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open wizard' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('AI Initiative Wizard');
  });

  it('exposes a dialog named in real Polish, not English fallback', async () => {
    render(<Harness language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open wizard' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Kreator Inicjatyw AI');
    expect(screen.queryByText('AI Initiative Wizard')).not.toBeInTheDocument();
  });

  it('names the close action in English', async () => {
    render(<Harness language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open wizard' }));
    await screen.findByRole('dialog');

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('names the close action in real Polish', async () => {
    render(<Harness language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open wizard' }));
    await screen.findByRole('dialog');

    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Harness language="en" />);
    const trigger = screen.getByRole('button', { name: 'Open wizard' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('clicking the named close button also closes the dialog', async () => {
    render(<Harness language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open wizard' }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
