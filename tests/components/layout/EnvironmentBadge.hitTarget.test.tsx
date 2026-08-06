/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { role: 'ADMIN' } }),
}));

vi.mock('../../../src/utils/publicProduction', () => ({
  isPublicProductionHost: () => false,
}));

import { EnvironmentBadge } from '../../../src/components/layout/EnvironmentBadge';

describe('EnvironmentBadge hit target safety', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ gitSha: '5d53f8b147eb37f5', environment: 'demo' }),
      })
    );
  });

  it('is informational and cannot intercept controls underneath it', async () => {
    render(<EnvironmentBadge />);

    const badge = await screen.findByTestId('environment-badge');
    expect(badge).toHaveClass('pointer-events-none');
    expect(badge).toHaveAttribute('role', 'status');
    expect(badge).toHaveAccessibleName(/Środowisko/i);
    expect(screen.queryByRole('button', { name: /środowisko/i })).not.toBeInTheDocument();
  });
});
