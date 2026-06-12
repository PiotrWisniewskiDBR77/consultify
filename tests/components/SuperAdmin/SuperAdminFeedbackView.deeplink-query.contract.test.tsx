/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const locationState = {
  pathname: '/superadmin/feedback',
  search: '',
};

const navigateMock = vi.fn();
const getFeedbackPageMock = vi.fn();
const getMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useNavigate: () => navigateMock,
}));

vi.mock('../../../src/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getFeedbackPage: (...args: unknown[]) => getFeedbackPageMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Mirror react-i18next: the second arg may be a fallback string OR an
    // options object carrying { defaultValue, ...interpolation }. Returning the
    // raw object (as a naive mock did) crashes React with "Objects are not valid
    // as a React child", so resolve it to a string here.
    t: (_key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object') {
        const value = (fallback as { defaultValue?: unknown }).defaultValue;
        return typeof value === 'string' ? value : '';
      }
      return '';
    },
    i18n: { language: 'en' },
  }),
}));

import { SuperAdminFeedbackView } from '../../../src/views/superadmin/SuperAdminFeedbackView';

const VALID_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';

describe('SuperAdminFeedbackView deep-link query contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationState.pathname = '/superadmin/feedback';
    locationState.search = '';
    getFeedbackPageMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 1000,
      offset: 0,
    });
    getMock.mockResolvedValue({
      id: VALID_ID,
      message: 'Detail message',
      status: 'NEW',
      type: 'BUG',
      created_at: new Date().toISOString(),
      user_email: 'ops@example.com',
    });
  });

  it('supports ticket alias and strips both feedbackId/ticket params after consume', async () => {
    locationState.search = `?ticket=${VALID_ID}`;
    render(<SuperAdminFeedbackView />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(`/feedback/${VALID_ID}`);
    });
    expect(navigateMock).toHaveBeenCalledWith(
      { pathname: '/superadmin/feedback', search: '' },
      { replace: true }
    );
  });

  it('fails closed for whitespace-only ticket query', async () => {
    locationState.search = '?ticket=%20%20%20';
    render(<SuperAdminFeedbackView />);

    await waitFor(() => {
      expect(getFeedbackPageMock).toHaveBeenCalled();
    });
    expect(getMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('prefers canonical feedbackId when both feedbackId and ticket are present', async () => {
    locationState.search = `?ticket=${VALID_ID}&feedbackId=${SECOND_ID}`;
    render(<SuperAdminFeedbackView />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(`/feedback/${SECOND_ID}`);
    });
    expect(getMock).not.toHaveBeenCalledWith(`/feedback/${VALID_ID}`);
  });

  it('shows non-leaking status message when deep-link detail fetch fails', async () => {
    locationState.search = `?ticket=${VALID_ID}`;
    getMock.mockRejectedValueOnce(new Error('SQLSTATE_INTERNAL_SECRET'));

    render(<SuperAdminFeedbackView />);

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Unable to open requested feedback ticket.');
    expect(status.textContent).not.toContain('SQLSTATE');
  });
});
