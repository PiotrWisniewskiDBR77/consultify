/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResourcesView } from '../../../src/views/partner/ResourcesView';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
  useNavigate: () => navigateMock,
}));

describe('ResourcesView redirect shim', () => {
  it('renders the deprecated resources surface with a route to canonical partner documentation', () => {
    render(<ResourcesView />);

    screen.getByRole('button', { name: /Open portal resources/i }).click();
    expect(navigateMock).toHaveBeenCalledWith('/partner?tab=documentation');
  });
});
