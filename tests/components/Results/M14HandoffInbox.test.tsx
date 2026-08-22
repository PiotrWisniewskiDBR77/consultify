/**
 * @vitest-environment jsdom
 *
 * M14 → M15 closure-handoff inbox (Decision B1b) — component test.
 * Verifies the reader renders incoming benefits, the empty state, and the
 * Promote / Dismiss actions call the governed V8 results API and drop the row.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { M14HandoffInbox } from '../../../src/components/Results/M14HandoffInbox';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

vi.mock('react-i18next', () => {
  // Stable `t` reference (mirrors real i18next, whose `t` is stable across
  // renders). A fresh `t` each render would make the component's `load`
  // callback unstable and re-fire its effect — a mock artifact, not the
  // component's behaviour.
  const stableT = (_key: string, fallback?: string, vars?: Record<string, unknown>) => {
    let out = fallback || _key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replace(`{{${k}}}`, String(v));
      }
    }
    return out;
  };
  return { useTranslation: () => ({ t: stableT }) };
});

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getClosureBenefitsInbox: vi.fn(),
    promoteClosureBenefit: vi.fn(),
    dismissClosureBenefit: vi.fn(),
  },
}));

const BENEFIT = {
  id: 'ben-1',
  initiativeId: 'init-1',
  initiativeName: 'Cost program',
  kpiName: 'Annual savings',
  sourceKpiId: 'kpi-src-1',
  unit: 'PLN',
  description: 'Save money',
  targetValue: 120000,
  status: 'tracking',
  closedAt: '2026-06-29T00:00:00.000Z',
  createdAt: '2026-06-30T10:00:00.000Z',
};

describe('M14HandoffInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders incoming closure-handoff benefits', async () => {
    vi.mocked(V8ResultsApi.getClosureBenefitsInbox).mockResolvedValue({
      items: [BENEFIT],
    } as any);

    render(<M14HandoffInbox />);

    expect(await screen.findByText('Annual savings')).toBeInTheDocument();
    expect(screen.getByText(/Cost program/)).toBeInTheDocument();
    expect(screen.getByText(/120000 PLN/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no benefits', async () => {
    vi.mocked(V8ResultsApi.getClosureBenefitsInbox).mockResolvedValue({
      items: [],
    } as any);

    render(<M14HandoffInbox />);

    expect(await screen.findByText('No new benefits from closed initiatives.')).toBeInTheDocument();
  });

  it('promotes a benefit and removes it from the list', async () => {
    vi.mocked(V8ResultsApi.getClosureBenefitsInbox).mockResolvedValue({
      items: [BENEFIT],
    } as any);
    vi.mocked(V8ResultsApi.promoteClosureBenefit).mockResolvedValue({
      kpiId: 'kpi-new',
      alreadyPromoted: false,
    } as any);
    const onPromoted = vi.fn();

    render(<M14HandoffInbox onPromoted={onPromoted} />);

    const promoteBtn = await screen.findByRole('button', { name: /Promote to tracked KPI/ });
    fireEvent.click(promoteBtn);

    await waitFor(() => {
      expect(V8ResultsApi.promoteClosureBenefit).toHaveBeenCalledWith('ben-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Annual savings')).not.toBeInTheDocument();
    });
    expect(onPromoted).toHaveBeenCalled();
  });

  it('dismisses a benefit and removes it from the list', async () => {
    vi.mocked(V8ResultsApi.getClosureBenefitsInbox).mockResolvedValue({
      items: [BENEFIT],
    } as any);
    vi.mocked(V8ResultsApi.dismissClosureBenefit).mockResolvedValue({
      success: true,
    } as any);

    render(<M14HandoffInbox />);

    const dismissBtn = await screen.findByRole('button', { name: /Dismiss/ });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(V8ResultsApi.dismissClosureBenefit).toHaveBeenCalledWith('ben-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Annual savings')).not.toBeInTheDocument();
    });
  });
});
