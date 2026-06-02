import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountRecoverySettings } from '@/components/settings/AccountRecoverySettings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

describe('AccountRecoverySettings', () => {
  it('marks recovery actions read-only instead of generating browser-only recovery data', () => {
    render(
      <AccountRecoverySettings
        currentUser={{ id: 'u1', email: 'user@example.com', role: 'user' } as any}
      />
    );

    expect(screen.getByText('Recovery options unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Recovery email, phone, backup codes, and trusted device changes are read-only/i
      )
    ).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: /Verify/i })).toHaveLength(2);
    screen.getAllByRole('button', { name: /Verify/i }).forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: /Generate New Codes/i })).toBeDisabled();
    expect(screen.queryByText('XXXX-XXXX-XXXX')).not.toBeInTheDocument();
  });
});
