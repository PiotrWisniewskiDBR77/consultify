import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { OrganizationSidebar } from '../../../src/components/Organization/OrganizationSidebar';

describe('OrganizationSidebar (L2)', () => {
  it('renders navigation items and calls callbacks', () => {
    const onSectionChange = vi.fn();
    const onBack = vi.fn();

    render(
      <OrganizationSidebar
        activeSection="profile"
        onSectionChange={onSectionChange}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Back to Dashboard/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Goals/i }));
    expect(onSectionChange).toHaveBeenCalledWith('goals');
  });

  it('toggles group open/closed', () => {
    const onSectionChange = vi.fn();
    render(<OrganizationSidebar activeSection="profile" onSectionChange={onSectionChange} />);

    const groupBtn = screen.getByRole('button', { name: /ORGANIZATION/i });
    fireEvent.click(groupBtn);

    // Items should be hidden when closed (not in DOM)
    expect(screen.queryByRole('button', { name: /Profile/i })).not.toBeInTheDocument();

    fireEvent.click(groupBtn);
    expect(screen.getByRole('button', { name: /Profile/i })).toBeInTheDocument();
  });

  it('auto-expands group when active section changes', () => {
    const onSectionChange = vi.fn();
    const { rerender } = render(
      <OrganizationSidebar activeSection="profile" onSectionChange={onSectionChange} />
    );

    // Close the group
    fireEvent.click(screen.getByRole('button', { name: /ORGANIZATION/i }));
    expect(screen.queryByRole('button', { name: /Goals/i })).not.toBeInTheDocument();

    // Change active section -> effect should expand group again
    rerender(<OrganizationSidebar activeSection="strategy" onSectionChange={onSectionChange} />);
    expect(screen.getByRole('button', { name: /Strategy/i })).toBeInTheDocument();
  });

  it('renders without back button when onBack is not provided', () => {
    render(<OrganizationSidebar activeSection="profile" onSectionChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /Back to Dashboard/i })).not.toBeInTheDocument();
  });

  it('does not crash when activeSection is unknown', () => {
    render(<OrganizationSidebar activeSection={'unknown' as any} onSectionChange={() => {}} />);
    expect(screen.getByRole('button', { name: /ORGANIZATION/i })).toBeInTheDocument();
  });
});
