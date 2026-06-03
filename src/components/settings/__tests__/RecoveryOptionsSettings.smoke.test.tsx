/**
 * @vitest-environment jsdom
 *
 * Smoke test for RecoveryOptionsSettings — verifies recovery options load and a
 * new recovery email is persisted via PUT /settings/recovery.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title }: { title?: string }) => <div role="alert">{title}</div>,
}));

const { apiGet, apiPut } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPut: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: { get: apiGet, put: apiPut, post: vi.fn(async () => ({})) },
}));

import { RecoveryOptionsSettings } from '../RecoveryOptionsSettings';

const currentUser = { id: 'user-1', email: 't@e.com' } as never;

beforeEach(() => {
  apiGet.mockReset();
  apiPut.mockReset();
  apiGet.mockResolvedValue({ recoveryEmail: '', recoveryPhone: '', backupCodesCount: 0 });
  apiPut.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RecoveryOptionsSettings smoke', () => {
  it('loads recovery options on mount', async () => {
    render(<RecoveryOptionsSettings currentUser={currentUser} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/settings/recovery'));
    expect(screen.getByText('Recovery Email')).toBeInTheDocument();
  });

  it('persists a new recovery email via PUT /settings/recovery', async () => {
    // After saving, the reload returns the persisted email.
    apiGet
      .mockResolvedValueOnce({ recoveryEmail: '', recoveryPhone: '', backupCodesCount: 0 })
      .mockResolvedValue({
        recoveryEmail: 'recover@example.com',
        recoveryPhone: '',
        backupCodesCount: 0,
      });

    render(<RecoveryOptionsSettings currentUser={currentUser} />);
    await waitFor(() => expect(screen.getByText('Recovery Email')).toBeInTheDocument());

    // Enter edit mode for the email recovery option ("Add" button).
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    const input = screen.getByPlaceholderText('Enter recovery email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'recover@example.com' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/settings/recovery', {
        recoveryEmail: 'recover@example.com',
      })
    );
  });
});
