/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OrganizationV8CanonPanel } from '../../../src/components/Organization/OrganizationV8CanonPanel';

describe('OrganizationV8CanonPanel', () => {
  it('renders the canonical tenant organization model and reuse contract', () => {
    render(<OrganizationV8CanonPanel compact />);

    expect(screen.getByText('One canonical tenant organization product')).toBeInTheDocument();
    expect(screen.getByText('Profile and branding')).toBeInTheDocument();
    expect(screen.getByText('Domains and trust controls')).toBeInTheDocument();
    expect(screen.getByText('Downstream reuse contract')).toBeInTheDocument();
  });
});
