import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentsSection } from '../CommentsSection';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { count?: number }) =>
      typeof fallback === 'string' ? fallback : '',
  }),
}));

describe('MyWork mutation result contract (red contract)', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('does not announce comment success when the mutation has no positive result', async () => {
    render(
      <CommentsSection
        comments={[]}
        expanded
        onAddComment={async () => undefined}
        onDeleteComment={async () => undefined}
        onLikeComment={async () => undefined}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Write a comment...'), {
      target: { value: 'not persisted' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
