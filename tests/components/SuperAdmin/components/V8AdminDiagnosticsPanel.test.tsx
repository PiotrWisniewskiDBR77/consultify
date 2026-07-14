/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/services/api/v8', () => ({
  V8AdminApi: {
    getHealth: vi.fn(),
    getMetrics: vi.fn(),
    getShadowStats: vi.fn(),
    getShadowComparisons: vi.fn(),
    getShadowPromotionReadiness: vi.fn(),
  },
}));

import { V8AdminDiagnosticsPanel } from '../../../../src/views/superadmin/components/V8AdminDiagnosticsPanel';
import { V8AdminApi } from '../../../../src/services/api/v8';

describe('V8AdminDiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8AdminApi.getHealth).mockResolvedValue({
      health: { overall: 'healthy' },
      integrity: { driftCount: 0 },
      domainReadiness: [{ domain: 'prompt-os', status: 'ready' }],
    } as any);
    vi.mocked(V8AdminApi.getMetrics).mockResolvedValue({
      requests: 12,
      avgLatencyMs: 142,
    } as any);
    vi.mocked(V8AdminApi.getShadowStats).mockResolvedValue({
      mismatchRate: 0,
    } as any);
    vi.mocked(V8AdminApi.getShadowComparisons).mockResolvedValue({
      comparisons: [{ comparisonId: 'cmp-1' }],
    } as any);
    vi.mocked(V8AdminApi.getShadowPromotionReadiness).mockResolvedValue({
      ready: true,
      blockers: [],
    } as any);
  });

  it('renders bounded V8 diagnostics for superadmin verification', async () => {
    render(<V8AdminDiagnosticsPanel />);

    await waitFor(() => {
      expect(screen.getByText('V8 Superadmin Diagnostics')).toBeInTheDocument();
      expect(screen.getByText('healthy')).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('cmp-1')).toBeInTheDocument();
    expect(V8AdminApi.getShadowComparisons).toHaveBeenCalledWith(5);
  });
});
