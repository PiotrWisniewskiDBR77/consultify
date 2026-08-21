import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DomainScreenHeader } from '../DomainScreenHeader';

describe('DomainScreenHeader', () => {
  it('renders one semantic page title and an accessible domain-module-screen breadcrumb', () => {
    const onDomain = vi.fn();
    render(
      <DomainScreenHeader
        breadcrumbs={[
          { label: 'Organization', onClick: onDomain },
          { label: 'Challenges' },
          { label: 'Evidence' },
        ]}
        title="Evidence"
        subtitle="Facts, decisions, and status for this area"
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Evidence' })).toHaveClass(
      'type-page-title'
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Evidence', { selector: '[aria-current="page"]' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Organization' }));
    expect(onDomain).toHaveBeenCalledOnce();
  });

  it('keeps the canonical action slot adjacent to the title block', () => {
    render(
      <DomainScreenHeader
        breadcrumbs={[{ label: 'Settings' }, { label: 'Profile' }]}
        title="Profile"
        actions={<button type="button">Save Changes</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' }).parentElement).toHaveClass(
      'domain-screen-actions'
    );
  });
});
