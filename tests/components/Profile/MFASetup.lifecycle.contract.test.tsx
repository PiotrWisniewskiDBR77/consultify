import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MFASetup } from '../../../src/components/Profile/MFASetup';
import { Api } from '../../../src/services/api';

vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiGet = vi.mocked(Api.get);
const apiPost = vi.mocked(Api.post);

function renderEnabled(onUpdate = vi.fn()) {
  apiGet.mockImplementation(async (path: string) => {
    if (path === '/api/mfa/methods') {
      return {
        enabled: true,
        methods: [],
        primary: 'app',
        smsAvailable: false,
      } as never;
    }
    return {
      isEnabled: true,
      method: 'totp',
      backupCodesRemaining: 8,
    } as never;
  });
  render(<MFASetup isEnabled onUpdate={onUpdate} />);
  return onUpdate;
}

describe('MFASetup destructive lifecycle contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the canonical backup-code regeneration route and suppresses duplicate submits', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    apiPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never
    );
    renderEnabled();

    fireEvent.click(await screen.findByRole('button', { name: /regenerate backup codes/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /enter your 2fa code/i }), {
      target: { value: '123456' },
    });
    const submit = screen.getByRole('button', { name: /^regenerate$/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/api/mfa/regenerate-backup-codes', {
      token: '123456',
    });

    resolveRequest({ success: true, backupCodes: ['SAFE-CODE'] });
    expect(await screen.findByText('SAFE-CODE')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /enter your 2fa code/i })).toHaveValue('');
  });

  it('requires password and TOTP reauthentication and clears secrets after success', async () => {
    const onUpdate = renderEnabled();
    fireEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }));

    const password = screen.getByLabelText(/current password/i);
    const token = screen.getByLabelText(/enter your 2fa code/i);
    fireEvent.change(token, { target: { value: '654321' } });
    expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeDisabled();

    fireEvent.change(password, { target: { value: 'correct horse' } });
    apiPost.mockResolvedValueOnce({ success: true } as never);
    fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/api/mfa/disable', {
        token: '654321',
        password: 'correct horse',
      })
    );
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByDisplayValue('correct horse')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('654321')).not.toBeInTheDocument();
  });

  it('fails closed and announces an API rejection without reporting success', async () => {
    const onUpdate = renderEnabled();
    fireEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'wrong password' },
    });
    fireEvent.change(screen.getByLabelText(/enter your 2fa code/i), {
      target: { value: '111111' },
    });
    apiPost.mockRejectedValueOnce({
      response: { data: { error: 'Reauthentication failed' } },
    });
    fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reauthentication failed');
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('wrong password')).toBeInTheDocument();
  });
});
