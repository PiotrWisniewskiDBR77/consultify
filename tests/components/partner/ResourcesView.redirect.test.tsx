/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResourcesView } from '../../../src/views/partner/ResourcesView';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
}));

describe('ResourcesView redirect shim', () => {
  it('redirects the deprecated resources surface to the canonical partner documentation tab', () => {
    render(<ResourcesView />);

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/partner?tab=documentation');
  });
});
