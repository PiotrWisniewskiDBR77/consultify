import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getSecurityRoles } from '../../../services/adminRolesApi';
import { AdminRolesPermissionsPanel } from '../AdminRolesPermissionsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminRolesApi', () => ({
  getSecurityRoles: vi.fn(),
  createSecurityRole: vi.fn(),
  updateSecurityRole: vi.fn(),
  deleteSecurityRole: vi.fn(),
}));
describe('AdminRolesPermissionsPanel', () => {
  it('loads roles', async () => {
    vi.mocked(getSecurityRoles).mockResolvedValue([
      { id: 'r1', name: 'Reviewer', permissions: ['read'] },
    ]);
    render(<AdminRolesPermissionsPanel />);
    expect(await screen.findByText('Reviewer')).toBeInTheDocument();
  });
  it('shows honest empty state', async () => {
    vi.mocked(getSecurityRoles).mockResolvedValue([]);
    render(<AdminRolesPermissionsPanel />);
    expect(await screen.findByText('Brak ról niestandardowych')).toBeInTheDocument();
  });
  it('fails closed for ADMIN 403', async () => {
    vi.mocked(getSecurityRoles).mockRejectedValue(
      Object.assign(new Error('PROJECT_ROLES_MANAGE_REQUIRED'), {
        code: 'PROJECT_ROLES_MANAGE_REQUIRED',
      })
    );
    render(<AdminRolesPermissionsPanel />);
    expect(await screen.findByText(/wymaga uprawnienia właściciela/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nazwa roli')).not.toBeInTheDocument();
  });
});
