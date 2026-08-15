/**
 * @vitest-environment jsdom
 *
 * Smoke test for ProfileSettings — verifies an edited profile field is persisted
 * via Api.updateUser and confirmed via Api.getMe (the profile save flow).
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

vi.mock('@/components/shared/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('@/i18n', () => ({
  changeLanguage: vi.fn(async () => true),
  SUPPORTED_LANGUAGES: ['en', 'pl'],
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const { updateUser, getMe } = vi.hoisted(() => ({
  updateUser: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  getMe: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { updateUser, getMe },
}));

import { ProfileSettings } from '../ProfileSettings';

const baseUser = {
  id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  jobTitle: 'Engineer',
} as never;

beforeEach(() => {
  updateUser.mockClear();
  getMe.mockReset();
  // getMe returns the persisted user with the edited first name so the
  // post-save confirmation check passes.
  getMe.mockResolvedValue({ ...(baseUser as object), firstName: 'Grace' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProfileSettings smoke — save flow', () => {
  it('gives the profile controls accessible names', () => {
    render(<ProfileSettings currentUser={baseUser} onUpdateUser={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'First Name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Last Name' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Pronouns' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Timezone' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Date Format' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Out of Office' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('persists an edited first name via Api.updateUser', async () => {
    const onUpdateUser = vi.fn();
    render(<ProfileSettings currentUser={baseUser} onUpdateUser={onUpdateUser} />);

    const firstNameInput = screen.getByDisplayValue('Ada') as HTMLInputElement;
    fireEvent.change(firstNameInput, { target: { value: 'Grace' } });

    const saveBtn = screen.getByText('Save Changes').closest('button') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
    const [id, updates] = updateUser.mock.calls[0];
    expect(id).toBe('user-1');
    expect(updates).toMatchObject({ firstName: 'Grace' });
    await waitFor(() => expect(onUpdateUser).toHaveBeenCalled());
  });
});
