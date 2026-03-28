/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DirectoryView } from '../../../src/views/partner/DirectoryView';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
}));

describe('DirectoryView redirect shim', () => {
  it('redirects the deprecated directory surface to the canonical partner listing tab', () => {
    render(<DirectoryView />);

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/partner?tab=public-listing');
  });
});
