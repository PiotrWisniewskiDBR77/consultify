/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import {
  SurveyShell,
  type SurveyAnswer,
  type SurveySection,
} from '@/components/Survey/SurveyShell';

const sections: SurveySection[] = [
  {
    id: 'main',
    title: { en: 'Main', pl: 'Glowne' },
    questions: [
      {
        id: 'q1',
        order: 1,
        text: { en: 'What is your current setup?', pl: 'Jaki jest obecny setup?' },
        type: 'single_choice',
        options: [
          { value: 'manual', label: { en: 'Manual', pl: 'Manualny' } },
          { value: 'partial', label: { en: 'Partial', pl: 'Czesciowy' } },
        ],
        required: true,
      },
      {
        id: 'q2',
        order: 2,
        text: { en: 'What is your biggest blocker?', pl: 'Jaka jest glowna blokada?' },
        type: 'free_text',
        required: true,
      },
    ],
  },
];

function renderSurvey(props?: Partial<React.ComponentProps<typeof SurveyShell>>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <SurveyShell
        sections={sections}
        language="en"
        focusMode={true}
        onAnswer={() => {}}
        onSubmit={() => {}}
        {...props}
      />
    </I18nextProvider>
  );
}

describe('SurveyShell capture and resume', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('resumes on the first unanswered question when initial answers exist', () => {
    const initialAnswers: SurveyAnswer[] = [{ questionId: 'q1', value: 'manual' }];

    renderSurvey({ initialAnswers });

    expect(screen.getByText('What is your biggest blocker?')).toBeInTheDocument();
    expect(screen.queryByText('What is your current setup?')).not.toBeInTheDocument();
  });

  it('autosaves the latest answer payload instead of a stale snapshot', () => {
    vi.useFakeTimers();
    const onAutosave = vi.fn();

    renderSurvey({ onAutosave });

    fireEvent.click(screen.getByRole('button', { name: /Manual/i }));
    vi.advanceTimersByTime(2100);

    expect(onAutosave).toHaveBeenCalledTimes(1);
    expect(onAutosave).toHaveBeenCalledWith([{ questionId: 'q1', value: 'manual' }], 0);
  });

  it('re-enables submit after the submit callback resolves', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderSurvey({
      focusMode: false,
      onSubmit,
      initialAnswers: [
        { questionId: 'q1', value: 'manual' },
        { questionId: 'q2', value: 'Blocker' },
      ],
    });

    const submitButton = screen.getByRole('button', { name: /Submit/i });
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: 'q1', value: 'manual' },
      { questionId: 'q2', value: 'Blocker' },
    ]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submit/i })).not.toBeDisabled();
    });
  });

  it('shows an explicit read-only banner when the survey is locked', () => {
    renderSurvey({ locked: true });

    expect(screen.getByText('Read-only mode')).toBeInTheDocument();
    expect(
      screen.getByText('You can review the survey, but answering and submitting are currently disabled.')
    ).toBeInTheDocument();
  });
});
