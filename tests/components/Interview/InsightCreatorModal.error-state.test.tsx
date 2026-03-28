/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const apiGetMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
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

import { InsightCreatorModal } from '../../../src/components/Interview/InsightCreatorModal';

describe('InsightCreatorModal load honesty', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('shows a retryable load error instead of pretending there are no completed sessions', async () => {
    apiGetMock.mockRejectedValue(new Error('network failed'));

    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Insight generator is temporarily unavailable.')).toBeInTheDocument();
    });

    expect(
      screen.getByText('This does not mean there are no completed sessions. Retry loading the data.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No completed sessions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(4);
    });
  });
});
