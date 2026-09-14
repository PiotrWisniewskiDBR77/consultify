/**
 * @vitest-environment jsdom
 *
 * DEC-496 (P-P15, Pawel): the Report tab is bug-only — the old Bug/Idea
 * type switcher inside Report is removed and the submitted type is
 * hardcoded to BUG. "Idea" now lives only in the renamed Feature tab
 * ("Idea / Feature").
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendFeedbackMock = vi.fn();

const appStoreState = {
  currentUser: { id: 'u-1', email: 'user@example.com', full_name: 'User', role: 'consultant' },
  activeSidePanel: 'FEEDBACK',
  closeSidePanel: vi.fn(),
};

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || '',
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => appStoreState,
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    sendFeedback: (...args: unknown[]) => sendFeedbackMock(...args),
    getFeedbackAIInsights: vi.fn(async () => ({ insights: [] })),
    composeFeedback: vi.fn(async () => ({})),
    submitPulseFeedback: vi.fn(async () => ({})),
    submitFeatureFeedback: vi.fn(async () => ({})),
  },
}));

vi.mock('../../../src/services/feedbackCollector', () => ({
  buildFeedbackDossier: vi.fn(async () => null),
}));

import { FeedbackSidePanel } from '../../../src/components/Feedback/FeedbackSidePanel';

describe('FeedbackSidePanel — Report tab is bug-only (DEC-496)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendFeedbackMock.mockResolvedValue({ success: true });
  });

  it('does not render a Bug/Idea type switcher in Report', () => {
    render(<FeedbackSidePanel />);

    expect(screen.queryByRole('button', { name: 'Bug' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Idea' })).toBeNull();
  });

  it('renames the Feature tab to "Idea / Feature"', () => {
    render(<FeedbackSidePanel />);

    expect(screen.getByRole('button', { name: /Idea \/ Feature/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Feature$/ })).toBeNull();
  });

  it('submits type BUG from the Report tab', async () => {
    const user = userEvent.setup();
    render(<FeedbackSidePanel />);

    await user.type(
      screen.getByPlaceholderText('Describe what happened and steps to reproduce...'),
      'Bug report body'
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(sendFeedbackMock).toHaveBeenCalledTimes(1);
    });
    expect(sendFeedbackMock.mock.calls[0][0]).toMatchObject({ type: 'BUG' });
  });
});
