/**
 * @vitest-environment jsdom
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

describe('FeedbackSidePanel submit error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendFeedbackMock.mockResolvedValue({ success: true });
  });

  it('renders non-leaking alert when report submit fails', async () => {
    sendFeedbackMock.mockRejectedValueOnce(
      new Error('internal: SQLSTATE[HY000] /var/app/secrets should not leak')
    );

    const user = userEvent.setup();
    render(<FeedbackSidePanel />);

    await user.type(
      screen.getByPlaceholderText('Describe what happened and steps to reproduce...'),
      'Bug report body'
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Failed to submit feedback');
    expect(alert.textContent).not.toContain('SQLSTATE');
    expect(alert.textContent).not.toContain('/var/');
    expect(alert.textContent).not.toContain('internal:');
  });

  it('does not render submit error alert on successful submit', async () => {
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
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
