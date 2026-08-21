import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import SettingsSidebar from '@/components/settings/SettingsSidebar';
import { SettingsView } from '@/views/SettingsView';

vi.mock('@/components/settings/ProfileSettings', () => ({
  ProfileSettings: () => <div>Profile preference state</div>,
}));

describe('canonical Settings navigation accessibility', () => {
  it('exposes collapsible navigation semantics and removes collapsed links from keyboard order', () => {
    const onSectionChange = vi.fn();
    render(
      <SettingsSidebar
        activeSection="auth-access"
        onSectionChange={onSectionChange}
        onBack={vi.fn()}
      />
    );

    const securityGroup = screen.getByRole('button', { name: 'Security' });
    expect(securityGroup).toHaveAttribute('aria-expanded', 'true');
    const active = screen.getByRole('button', { name: 'Authentication & Access' });
    expect(active).toHaveAttribute('aria-current', 'page');

    fireEvent.click(securityGroup);
    expect(securityGroup).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Authentication & Access' })
    ).not.toBeInTheDocument();

    fireEvent.click(securityGroup);
    fireEvent.click(screen.getByRole('button', { name: 'Security Overview' }));
    expect(onSectionChange).toHaveBeenCalledWith('security-dashboard');
  });

  it('provides a labelled mobile drawer, page landmark, and Escape dismissal', () => {
    render(
      <MemoryRouter initialEntries={['/settings/profile']}>
        <SettingsView
          currentUser={{ id: 'user-1', email: 'user@example.test', role: 'ADMIN' } as any}
          onUpdateUser={vi.fn()}
          theme="light"
          toggleTheme={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-labelledby', 'settings-page-title');

    const menu = screen.getByRole('button', { name: 'Open settings navigation' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByRole('button', { name: 'Close settings navigation' })
    ).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Close settings navigation' })
    ).not.toBeInTheDocument();
  });
});
