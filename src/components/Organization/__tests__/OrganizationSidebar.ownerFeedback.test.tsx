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
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={vi.fn()}
      />
    );

    expect(screen.queryByText('Megatrends')).not.toBeInTheDocument();
    expect(screen.queryByText('ADMINISTRATION')).not.toBeInTheDocument();
  });

  it('uses the final six-module hierarchy and keeps Knowledge Graph under Sources', () => {
    const onLocationChange = vi.fn();
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={onLocationChange}
      />
    );

    expect(
      screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-expanded'))
    ).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: /Źródła i wiedza/i }));
    fireEvent.click(screen.getByRole('button', { name: /Graf wiedzy/i }));

    expect(onLocationChange).toHaveBeenCalledWith({
      module: 'sources',
      screen: 'knowledge-graph',
    });
  });
});
