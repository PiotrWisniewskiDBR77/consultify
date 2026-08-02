/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const apiGetMock = vi.fn();
const listContextDocumentsMock = vi.fn();
const listInsightsMock = vi.fn();
const checkInsightSimilarityMock = vi.fn();
const createInsightMock = vi.fn();

import enTranslation from '../../../public/locales/en/translation.json';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

const tEn = (key: string, opt?: unknown): string => {
  const resolved = resolveEnKey(key);
  if (resolved !== undefined) return resolved;
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tEn,
    i18n: { language: 'en', changeLanguage: () => {}, getFixedT: () => tEn },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

vi.mock('@/components/ui/primitives/Modal', () => ({
  Modal: ({ open, children }: any) => (open ? <div>{children}</div> : null),
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    listContextDocuments: (...args: any[]) => listContextDocumentsMock(...args),
    listInsights: (...args: any[]) => listInsightsMock(...args),
    checkInsightSimilarity: (...args: any[]) => checkInsightSimilarityMock(...args),
    createInsight: (...args: any[]) => createInsightMock(...args),
    uploadContextDocument: vi.fn(),
  },
}));

import { InsightCreatorModal } from '../../../src/components/Interview/InsightCreatorModal';

const COMPLETED_SESSIONS = [
  {
    id: 'session-1',
    name: 'Customer Discovery',
    status: 'completed',
    approvalStatus: 'approved',
    completedAt: '2026-05-03T10:00:00.000Z',
    respondentId: 'respondent-1',
    respondentName: 'Anna Nowak',
    respondentRole: 'Operations Lead',
    department: 'Operations',
    respondentDepartment: 'Operations',
    answeredQuestions: 4,
    totalQuestions: 5,
  },
  {
    id: 'session-2',
    name: 'Finance Discovery',
    status: 'completed',
    approvalStatus: 'approved',
    completedAt: '2026-05-03T11:00:00.000Z',
    respondentId: 'respondent-2',
    respondentName: 'Jan Kowalski',
    respondentRole: 'Finance Lead',
    department: 'Finance',
    respondentDepartment: 'Finance',
    answeredQuestions: 3,
    totalQuestions: 5,
  },
];

function mockSessionsLoad() {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/interview/sessions/completed') {
      return Promise.resolve(COMPLETED_SESSIONS);
    }
    return Promise.resolve([]);
  });
}

/**
 * Drive the current 3-step wizard (Define -> Source -> Refine) to the point of
 * submission with topic focus, leading question, and consultant note filled in.
 * `selectSession` decides whether the Customer Discovery session is picked via its
 * accessible checkbox role or via its visible label text.
 */
async function fillWizardAndRun(selectSession: 'checkbox' | 'text') {
  // --- Step 1: Define (title + output types) ---
  fireEvent.change(screen.getByPlaceholderText('e.g. Digital Transformation Analysis Q1 2024'), {
    target: { value: 'Scoped report' },
  });
  fireEvent.click(screen.getByText('Between the Lines'));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  // --- Step 2: Source (sessions + scoping filters) ---
  await waitFor(() => {
    expect(screen.getByText('Customer Discovery')).toBeInTheDocument();
  });
  // Role/department filters live inside the collapsed "Filter" disclosure and are
  // portal-based custom dropdowns (button -> listbox), not native <select>s.
  fireEvent.click(screen.getByRole('button', { name: /Filter/i }));
  fireEvent.click(screen.getByLabelText('Respondent role filter'));
  fireEvent.click(screen.getByRole('option', { name: 'Operations Lead' }));
  fireEvent.click(screen.getByLabelText('Respondent department filter'));
  fireEvent.click(screen.getByRole('option', { name: 'Operations' }));
  if (selectSession === 'checkbox') {
    fireEvent.click(screen.getByRole('checkbox', { name: /Customer Discovery/i }));
  } else {
    fireEvent.click(screen.getByText('Customer Discovery'));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  // --- Step 3: Refine (leading question + advanced lens/topic/note) ---
  fireEvent.change(
    screen.getByPlaceholderText('e.g. Where do ownership handoffs most often break?'),
    {
      target: { value: 'Where do handoffs fail?' },
    }
  );
  // Lens, topic focus, and notes are inside the collapsed "Advanced" disclosure.
  fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));
  fireEvent.click(screen.getByText('Contradiction scan'));
  fireEvent.click(screen.getByRole('button', { name: 'Process and operations' }));
  fireEvent.change(
    screen.getByPlaceholderText(
      'e.g. Focus on differences between IT and business departments. Use formal language.'
    ),
    { target: { value: 'Look for cross-functional blockers.' } }
  );

  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
}

describe('InsightCreatorModal load honesty', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    listContextDocumentsMock.mockReset();
    listInsightsMock.mockReset();
    checkInsightSimilarityMock.mockReset();
    createInsightMock.mockReset();
    listContextDocumentsMock.mockResolvedValue({ documents: [] });
    listInsightsMock.mockResolvedValue({ insights: [] });
    checkInsightSimilarityMock.mockResolvedValue({ matches: [] });
  });

  it('shows a retryable load error instead of pretending there are no completed sessions', async () => {
    apiGetMock.mockRejectedValue(new Error('network failed'));

    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Insight generator is temporarily unavailable.')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'This does not mean there are no completed sessions. Retry loading the data.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('No completed sessions')).not.toBeInTheDocument();

    // Initial load issues two Api.get calls (sessions + saved baskets). The retry
    // re-runs the sessions fetch, so a successful retry must add at least one more.
    const callsBeforeRetry = apiGetMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));

    await waitFor(() => {
      expect(apiGetMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
    expect(
      apiGetMock.mock.calls.some((call) => call[0] === '/interview/sessions/completed')
    ).toBe(true);
  });

  it('sends topic focus, leading question, and consultant note as governed analysis scope', async () => {
    mockSessionsLoad();
    createInsightMock.mockResolvedValue({ id: 'insight-1' });

    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/interview/sessions/completed');
    });

    await fillWizardAndRun('checkbox');

    await waitFor(() => {
      expect(createInsightMock).toHaveBeenCalledWith(
        expect.objectContaining({
          topicFocus: ['process_and_operations'],
          consultantNote: 'Look for cross-functional blockers.',
          leadingQuestion: 'Where do handoffs fail?',
          filters: expect.objectContaining({
            roles: ['Operations Lead'],
            departments: ['Operations'],
            outputTypes: ['summary', 'between_the_lines'],
            analysisModes: ['general_consulting_synthesis', 'contradiction_scan'],
          }),
          analysisMode: 'contradiction_scan',
          analysisScope: expect.objectContaining({
            role_filters: ['Operations Lead'],
            department_filters: ['Operations'],
            topic_focus: ['process_and_operations'],
            analysis_mode: 'contradiction_scan',
            consultant_note: 'Look for cross-functional blockers.',
            leading_question: 'Where do handoffs fail?',
          }),
        })
      );
    });
  });

  it('preserves governed analysis scope when the session is picked by its label', async () => {
    mockSessionsLoad();
    createInsightMock.mockResolvedValue({ id: 'insight-1' });

    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/interview/sessions/completed');
    });

    await fillWizardAndRun('text');

    await waitFor(() => {
      expect(createInsightMock).toHaveBeenCalledWith(
        expect.objectContaining({
          topicFocus: ['process_and_operations'],
          consultantNote: 'Look for cross-functional blockers.',
          leadingQuestion: 'Where do handoffs fail?',
          filters: expect.objectContaining({
            roles: ['Operations Lead'],
            departments: ['Operations'],
            outputTypes: ['summary', 'between_the_lines'],
            analysisModes: ['general_consulting_synthesis', 'contradiction_scan'],
          }),
          analysisMode: 'contradiction_scan',
          analysisScope: expect.objectContaining({
            role_filters: ['Operations Lead'],
            department_filters: ['Operations'],
            topic_focus: ['process_and_operations'],
            analysis_mode: 'contradiction_scan',
            consultant_note: 'Look for cross-functional blockers.',
            leading_question: 'Where do handoffs fail?',
          }),
        })
      );
    });
  });
});
