/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessBlockedModal } from '../../../src/components/access/AccessBlockedModal';

const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      (
        {
          'access.modal.title': 'Access blocked',
          'access.cta.startTrial': 'Start free trial',
          'access.cta.goToMyWork': 'Go to my work',
          'access.modal.close': 'Close',
        } as Record<string, string>
      )[key] || fallback || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

describe('AccessBlockedModal', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('routes demo read-only blocks to the self-serve trial start path', async () => {
    render(<AccessBlockedModal />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('access:blocked', {
          detail: {
            code: 'DEMO_READ_ONLY',
            message: 'Demo mode is read-only.',
          },
        })
      );
    });

    await screen.findByText('Access blocked');
    fireEvent.click(screen.getByText('Start free trial'));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/trial/start');
    });
  });

  it('routes feature access denials to My Work', async () => {
    render(<AccessBlockedModal />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('access:blocked', {
          detail: {
            code: 'FEATURE_ACCESS_DENIED',
            message: 'Feature access denied for your current plan.',
          },
        })
      );
    });

    await screen.findByText('Access blocked');
    fireEvent.click(screen.getByText('Go to my work'));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work');
    });
  });
});
