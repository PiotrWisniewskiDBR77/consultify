import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AppView } from '../../../../src/types';
import { SidebarFooter } from '../../../../src/components/navigation/Sidebar/SidebarFooter';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

describe('SidebarFooter (L2)', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;

  it('renders partner portal and logout actions', () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();

    render(
      <SidebarFooter showFull onLogout={onLogout} onNavigate={onNavigate} t={t}>
        <div data-testid="child-items">children</div>
      </SidebarFooter>
    );

    expect(screen.getByTestId('child-items')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Partner Portal/i }));
    expect(onNavigate).toHaveBeenCalledWith(AppView.PARTNER_LANDING);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('hides partner portal when showPartnerPortal=false', () => {
    render(
      <SidebarFooter
        showFull={false}
        onLogout={() => {}}
        onNavigate={() => {}}
        t={t}
        showPartnerPortal={false}
      />
    );

    expect(screen.queryByTitle('Partner Portal')).not.toBeInTheDocument();
  });

  it('in collapsed mode uses title attributes and does not render text labels', () => {
    render(<SidebarFooter showFull={false} onLogout={() => {}} onNavigate={() => {}} t={t} />);

    const partner = screen.getByTitle('Partner Portal');
    expect(partner).toBeInTheDocument();
    expect(screen.queryByText('Partner Portal')).not.toBeInTheDocument();

    const logout = screen.getByTitle('sidebar.logOut');
    expect(logout).toBeInTheDocument();
    expect(screen.queryByText('sidebar.logOut')).not.toBeInTheDocument();
  });
});
