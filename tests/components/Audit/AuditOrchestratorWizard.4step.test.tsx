/**
 * @vitest-environment jsdom
 *
 * T5 — AuditOrchestratorWizard: 4-krokowy kreator programu audytu.
 * Weryfikuje: guard nazwy, nawigację przez 4 kroki, tworzenie programu,
 * obsługę błędu, zamknięcie bez zapisu (X).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) => {
      const translations: Record<string, string> = {
        'audit.newAuditProgram': 'New audit program',
        'audit.egIso27001Readiness': 'e.g. ISO 27001 readiness',
        'audit.defineObjectiveWhatToAsk': 'Define objective — what to ask',
        'audit.close': 'Close',
        'audit.cancel': 'Cancel',
        'audit.back': 'Back',
        'audit.next': 'Next',
        'audit.createProgram': 'Create program',
        'audit.custom': 'Custom',
        'audit.startBlank': 'Start blank',
        'audit.pickInterviewTemplates': 'Pick the interview templates this audit will ask.',
        'audit.pickPeopleWhoFillSurveys': 'Pick the people who will fill the surveys.',
        'audit.iso27001': 'ISO 27001',
      };
      if (typeof fallback === 'string') return fallback;
      return translations[key] || key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockListTemplateOptions = vi.fn();
const mockListUserOptions = vi.fn();
const mockCreateProgram = vi.fn();

vi.mock('../../../src/components/Audit/auditApi', () => ({
  listTemplateOptions: (...args: unknown[]) => mockListTemplateOptions(...args),
  listUserOptions: (...args: unknown[]) => mockListUserOptions(...args),
  createProgram: (...args: unknown[]) => mockCreateProgram(...args),
}));

// MultiSelect: render options as checkboxes so tests can interact with them.
vi.mock('../../../src/components/shared/forms', () => ({
  MultiSelect: ({ options, value, onChange, placeholder }: any) => (
    <div data-testid="multi-select">
      <span>{placeholder}</span>
      {(options ?? []).map((o: any) => (
        <label key={o.value}>
          <input
            type="checkbox"
            value={o.value}
            checked={(value ?? []).includes(o.value)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...(value ?? []), o.value]
                : (value ?? []).filter((v: string) => v !== o.value);
              onChange(next);
            }}
          />
          {o.label}
        </label>
      ))}
    </div>
  ),
}));

// WizardStepper: render step labels so we can assert current step.
vi.mock('../../../src/components/shared/WizardModal', () => ({
  WizardStepper: ({ steps, activeStepIndex, onStepChange }: any) => (
    <div data-testid="wizard-stepper">
      {(steps ?? []).map((s: any, i: number) => (
        <button
          key={s.id}
          data-active={i === activeStepIndex}
          onClick={() => onStepChange(i)}
        >
          {s.label?.en ?? s.id}
        </button>
      ))}
    </div>
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEMPLATE_OPTIONS = [
  { id: 't-1', name: 'Security baseline', category: 'ISO' },
  { id: 't-2', name: 'Process audit', category: 'Internal' },
];

const USER_OPTIONS = [
  { id: 'u-1', name: 'Anna Kowalska', email: 'anna@example.com' },
  { id: 'u-2', name: 'Jan Nowak', email: 'jan@example.com' },
];

const CREATED_PROGRAM = {
  id: 'prog-1',
  organizationId: 'org-1',
  name: 'Test Program',
  description: null,
  objective: 'Improve security posture',
  status: 'draft' as const,
  preset: null,
  config: { templateIds: ['t-1'], assigneeIds: ['u-1'], surveysGenerated: false },
  createdBy: 'u-1',
  createdAt: '2026-06-17T00:00:00Z',
  updatedAt: '2026-06-17T00:00:00Z',
};

function renderWizard(props: {
  open?: boolean;
  onClose?: () => void;
  onCreated?: (p: any) => void;
  initialPresetId?: string | null;
} = {}) {
  const onClose = props.onClose ?? vi.fn();
  const onCreated = props.onCreated ?? vi.fn();
  return {
    onClose,
    onCreated,
    ...render(
      <div>
        {/* Isolated wrapper so the modal overlay is findable in tests */}
        <AuditOrchestratorWizardUnderTest
          open={props.open ?? true}
          onClose={onClose}
          onCreated={onCreated}
          initialPresetId={props.initialPresetId ?? null}
        />
      </div>
    ),
  };
}

// Import AFTER mocks are registered.
import { AuditOrchestratorWizard as AuditOrchestratorWizardUnderTest } from '../../../src/components/Audit/AuditOrchestratorWizard';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditOrchestratorWizard — 4-step flow (T5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTemplateOptions.mockResolvedValue(TEMPLATE_OPTIONS);
    mockListUserOptions.mockResolvedValue(USER_OPTIONS);
    mockCreateProgram.mockResolvedValue(CREATED_PROGRAM);
  });

  it('renders nothing when open=false', () => {
    renderWizard({ open: false });
    expect(screen.queryByText(/New audit program/i)).not.toBeInTheDocument();
  });

  it('renders step 1 (Objective) on open', async () => {
    renderWizard();
    expect(screen.getByText(/New audit program/i)).toBeInTheDocument();
    // Stepper is present with 4 steps
    expect(screen.getByTestId('wizard-stepper')).toBeInTheDocument();
    // First step is active
    const stepBtns = screen.getAllByRole('button', { hidden: true });
    const objectiveBtn = stepBtns.find((b) => b.textContent === 'Objective');
    expect(objectiveBtn).toBeDefined();
    // Name field is present (label has no htmlFor — locate by placeholder)
    expect(screen.getByPlaceholderText(/iso 27001/i)).toBeInTheDocument();
  });

  it('Next is disabled until name is filled', async () => {
    renderWizard();
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeDisabled();

    const nameInput = screen.getByPlaceholderText(/iso 27001/i);
    fireEvent.change(nameInput, { target: { value: 'Security Audit 2026' } });
    expect(nextBtn).not.toBeDisabled();
  });

  it('Close button (X) fires onClose without creating', () => {
    const { onClose, onCreated } = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect(mockCreateProgram).not.toHaveBeenCalled();
  });

  it('navigates through all 4 steps via Next and reaches Review', async () => {
    renderWizard();

    // Step 1 → fill name → Next
    fireEvent.change(screen.getByPlaceholderText(/iso 27001/i), {
      target: { value: 'My Audit Program' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2 — Templates (multi-select rendered by mock)
    await waitFor(() => {
      expect(screen.getAllByTestId('multi-select').length).toBeGreaterThan(0);
    });

    // Select a template
    await waitFor(() => {
      expect(screen.getByLabelText('Security baseline')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Security baseline'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3 — Assignees
    await waitFor(() => {
      expect(screen.getByLabelText('Anna Kowalska')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Anna Kowalska'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4 — Review
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create program/i })
      ).toBeInTheDocument();
    });
  });

  it('creates program and fires onCreated + onClose on success', async () => {
    const { onClose, onCreated } = renderWizard();

    // Walk through steps quickly
    fireEvent.change(screen.getByPlaceholderText(/iso 27001/i), {
      target: { value: 'Test Program' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByTestId('multi-select'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Review step → Create
    const createBtn = await screen.findByRole('button', { name: /create program/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockCreateProgram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Program',
          status: 'draft',
          config: expect.objectContaining({ surveysGenerated: false }),
        })
      );
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(CREATED_PROGRAM);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error message when createProgram rejects', async () => {
    mockCreateProgram.mockRejectedValue(new Error('Network error'));
    renderWizard();

    // Navigate to review
    fireEvent.change(screen.getByPlaceholderText(/iso 27001/i), {
      target: { value: 'Fail Program' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByTestId('multi-select'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const createBtn = await screen.findByRole('button', { name: /create program/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('clicking step pill navigates back after name is filled', async () => {
    renderWizard();
    const nameInput = screen.getByPlaceholderText(/iso 27001/i);
    fireEvent.change(nameInput, { target: { value: 'My Audit' } });

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByTestId('multi-select'));

    // Click "Objective" pill to go back
    const objectiveBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent === 'Objective');
    if (objectiveBtn) fireEvent.click(objectiveBtn);

    expect(screen.getByPlaceholderText(/iso 27001/i)).toBeInTheDocument();
  });
});
