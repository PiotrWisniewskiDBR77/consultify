/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFeedbackBacklogTasksMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || '',
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getFeedbackBacklogTasks: (...args: unknown[]) => getFeedbackBacklogTasksMock(...args),
  },
}));

import { SuperAdminFeedbackBacklogView } from '../../../src/views/superadmin/SuperAdminFeedbackBacklogView';

describe('SuperAdminFeedbackBacklogView error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFeedbackBacklogTasksMock.mockResolvedValue([]);
  });

  it('renders non-leaking accessible alert with optional machine code on load failure', async () => {
    const err: any = new Error('internal: SQLSTATE[HY000] /var/app/secrets');
    err.code = 'FEEDBACK_BACKLOG_READ_FAILED';
    getFeedbackBacklogTasksMock.mockRejectedValueOnce(err);

    render(<SuperAdminFeedbackBacklogView />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Feedback backlog is temporarily unavailable.');
    expect(alert.textContent).not.toContain('SQLSTATE');
    expect(alert.textContent).not.toContain('/var/');
    expect(alert.textContent).not.toContain('internal:');
    expect(screen.getByTestId('feedback-backlog-error-code')).toHaveTextContent(
      'Code: FEEDBACK_BACKLOG_READ_FAILED'
    );
    expect(screen.queryByText('Open source feedback ticket')).toBeNull();
  });
});
