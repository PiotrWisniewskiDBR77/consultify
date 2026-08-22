import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { OrganizationSidebar } from '../../../src/components/Organization/OrganizationSidebar';

describe('OrganizationSidebar (L2)', () => {
  it('renders navigation items and calls callbacks', () => {
    const onLocationChange = vi.fn();
    const onBack = vi.fn();

    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={onLocationChange}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Back to Dashboard/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Goals & Expectations/i }));
    fireEvent.click(screen.getByRole('button', { name: /Strategic Intent/i }));
    expect(onLocationChange).toHaveBeenCalledWith({
      module: 'goals',
      screen: 'strategic-intent',
    });
  });

  it('toggles group open/closed', () => {
    const onLocationChange = vi.fn();
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={onLocationChange}
      />
    );

    const groupBtn = screen.getByRole('button', { name: /ORGANIZATION/i });
    fireEvent.click(groupBtn);

    // Items should be hidden when closed (not in DOM)
    expect(screen.queryByRole('button', { name: /Identity & Scale/i })).not.toBeInTheDocument();

    fireEvent.click(groupBtn);
    expect(screen.getByRole('button', { name: /Identity & Scale/i })).toBeInTheDocument();
  });

  it('auto-expands group when active section changes', () => {
    const onLocationChange = vi.fn();
    const { rerender } = render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={onLocationChange}
      />
    );

    // Close the group
    fireEvent.click(screen.getByRole('button', { name: /ORGANIZATION/i }));
    expect(screen.queryByRole('button', { name: /Identity & Scale/i })).not.toBeInTheDocument();

    // Change active section -> effect should expand group again
    rerender(
      <OrganizationSidebar
        activeLocation={{ module: 'strategy', screen: 'executive-brief' }}
        onLocationChange={onLocationChange}
      />
    );
    expect(screen.getByRole('button', { name: /Executive Brief/i })).toBeInTheDocument();
  });

  it('renders without back button when onBack is not provided', () => {
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /Back to Dashboard/i })).not.toBeInTheDocument();
  });

  it('does not crash when activeSection is unknown', () => {
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'unknown', screen: 'unknown' } as any}
        onLocationChange={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /ORGANIZATION/i })).toBeInTheDocument();
  });
});
