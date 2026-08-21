import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationSidebar } from '../OrganizationSidebar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

describe('OrganizationSidebar owner-feedback navigation', () => {
  it('does not expose Megatrends or Administration inside Organization', () => {
    render(<OrganizationSidebar activeSection="profile" onSectionChange={vi.fn()} />);

    expect(screen.queryByText('Megatrends')).not.toBeInTheDocument();
    expect(screen.queryByText('ADMINISTRATION')).not.toBeInTheDocument();
  });

  it('keeps existing destinations in one expandable Settings-style group', () => {
    const onSectionChange = vi.fn();
    render(<OrganizationSidebar activeSection="profile" onSectionChange={onSectionChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^ORGANIZATION$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ORGANIZATION$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Goals & expectations/i }));
    expect(onSectionChange).toHaveBeenCalledWith('goals');

    fireEvent.click(screen.getByRole('button', { name: /Knowledge Graph/i }));
    expect(onSectionChange).toHaveBeenCalledWith('knowledge-graph');
  });
});
