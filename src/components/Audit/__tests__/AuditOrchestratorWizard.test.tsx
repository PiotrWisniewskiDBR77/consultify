/**
 * @vitest-environment jsdom
 *
 * Component tests for AuditOrchestratorWizard (Module 12 — Audyty).
 *
 * Covers the multi-step create flow:
 *  - closed (open={false}) renders nothing,
 *  - open renders step 1 (Objective) with the name input + preset cards,
 *  - the Next button is gated until a program name is entered,
 *  - stepping forward reaches the Templates → Assignees → Review steps,
 *  - "Create program" calls createProgram() and fires onCreated with the result.
 *
 * The auditApi client is mocked so lookups resolve empty/deterministic offline.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const translate = (k: string, opts?: any) => {
    if (typeof opts === 'string') return opts;
    if (opts?.defaultValue) return opts.defaultValue;
    const TRANSLATIONS: Record<string, string> = {
      'audit.newAuditProgram': 'New audit program',
      'audit.egIso27001Readiness': 'e.g. ISO 27001 readiness',
      'audit.custom': 'Custom',
      'audit.next': 'Next',
      'audit.cancel': 'Cancel',
      'audit.back': 'Back',
      'audit.createProgram': 'Create program',
      'audit.startBlank': 'Start blank',
      'audit.pickInterviewTemplates': 'Pick the interview templates this audit will ask.',
      'audit.pickPeopleWhoFillSurveys': 'Pick the people who will fill the surveys.',
      'audit.defineObjectiveWhatToAsk': 'Define objective — what to ask',
      'audit.close': 'Close',
    };
    return TRANSLATIONS[k] || k;
  };
  return {
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'en', getFixedT: () => translate },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  };
});

const { createProgram, listTemplateOptions, listUserOptions } = vi.hoisted(() => ({
  createProgram: vi.fn(),
  listTemplateOptions: vi.fn(),
  listUserOptions: vi.fn(),
}));

vi.mock('../auditApi', () => ({
  createProgram,
  listTemplateOptions,
  listUserOptions,
}));

import { AuditOrchestratorWizard } from '../AuditOrchestratorWizard';

beforeEach(() => {
  createProgram.mockReset();
  listTemplateOptions.mockReset();
  listUserOptions.mockReset();
  listTemplateOptions.mockResolvedValue([{ id: 't1', name: 'Security baseline' }]);
  listUserOptions.mockResolvedValue([{ id: 'u1', name: 'Jane Doe', email: 'jane@x.io' }]);
  createProgram.mockResolvedValue({
    id: 'created-1',
    name: 'My audit',
    status: 'draft',
    config: {},
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuditOrchestratorWizard', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AuditOrchestratorWizard open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on step 1 with a name field and preset cards', async () => {
    render(<AuditOrchestratorWizard open onClose={vi.fn()} />);
    expect(screen.getByText('New audit program')).toBeInTheDocument();
    // step-1 fields
    expect(screen.getByPlaceholderText('e.g. ISO 27001 readiness')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    await waitFor(() => {
      expect(listTemplateOptions).toHaveBeenCalledTimes(1);
      expect(listUserOptions).toHaveBeenCalledTimes(1);
    });
  });

  it('gates Next until a program name is entered', async () => {
    render(<AuditOrchestratorWizard open onClose={vi.fn()} />);
    const next = screen.getByText('Next').closest('button') as HTMLButtonElement;
    expect(next).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('e.g. ISO 27001 readiness'), {
      target: { value: 'My audit' },
    });
    expect(next).not.toBeDisabled();
    await waitFor(() => {
      expect(listTemplateOptions).toHaveBeenCalledTimes(1);
      expect(listUserOptions).toHaveBeenCalledTimes(1);
    });
  });

  it('steps through to Review and creates the program', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<AuditOrchestratorWizard open onClose={onClose} onCreated={onCreated} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. ISO 27001 readiness'), {
      target: { value: 'My audit' },
    });

    // Objective -> Templates
    fireEvent.click(screen.getByText('Next').closest('button')!);
    expect(
      await screen.findByText('Pick the interview templates this audit will ask.')
    ).toBeInTheDocument();

    // Templates -> Assignees
    fireEvent.click(screen.getByText('Next').closest('button')!);
    expect(
      await screen.findByText('Pick the people who will fill the surveys.')
    ).toBeInTheDocument();

    // Assignees -> Review. "Create program" appears in both the stepper pill
    // (label "Review" + hint) and the footer CTA; the footer button's accessible
    // name is exactly "Create program".
    fireEvent.click(screen.getByText('Next').closest('button')!);
    const createBtns = await screen.findAllByRole('button', { name: /Create program/ });
    const createBtn = createBtns.find((b) => (b.textContent || '').trim() === 'Create program')!;
    expect(createBtn).toBeTruthy();

    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(createProgram).toHaveBeenCalledTimes(1);
    });
    expect(createProgram.mock.calls[0][0]).toMatchObject({ name: 'My audit', status: 'draft' });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'created-1' }));
    });
  });
});
