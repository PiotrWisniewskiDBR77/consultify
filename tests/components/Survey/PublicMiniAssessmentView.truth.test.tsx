/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { PublicMiniAssessmentView } from '@/views/PublicMiniAssessmentView';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ token: 'tok-123' }),
    useSearchParams: () => [new URLSearchParams('lang=en'), vi.fn()],
  };
});

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

describe('PublicMiniAssessmentView truth framing', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'ma-1',
          token: 'tok-123',
          status: 'completed',
          language: 'en',
          template: { questions: [] },
          answers: [{ questionId: 'q1', value: 'manual' }],
          aiResult: {
            resultKind: 'rules_based_snapshot',
            resultLabel: 'Rules-based readiness snapshot',
            methodNotes: ['Rules-based snapshot only'],
            overallScore: 52,
            overallLevel: 'developing',
            dimensions: [
              { name: 'Digital Strategy', score: 2, maxScore: 4, level: 'developing' },
            ],
            insights: ['Strengthen strategy-to-execution alignment.'],
            assumptions: ['Result based solely on provided answers'],
            biggestChallenge: 'Manual processes',
            followUpTopics: ['Explore in more depth: Digital Strategy'],
            answerSummary: [
              {
                questionId: 'q1',
                question: 'Does your organization have a formal digital transformation strategy?',
                answer: 'Manual',
              },
            ],
          },
        }),
      })
    );
  });

  it('renders an honest rules-based result and the follow-up interview action', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <PublicMiniAssessmentView />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Rules-based readiness snapshot')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'This is a rules-based snapshot from your form answers, not a full consulting diagnosis.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Follow-up Interview Brief' })).toBeInTheDocument();
    expect(screen.getByText('Manual processes')).toBeInTheDocument();
  });
});
