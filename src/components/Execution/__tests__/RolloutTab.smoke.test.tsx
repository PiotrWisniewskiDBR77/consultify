/**
 * @vitest-environment jsdom
 *
 * Smoke tests for RolloutTab (Module 06 Realizacja — rollout consolidation).
 *
 * Verifies the rollout sub-resources are backed by real /api/rollout/* calls
 * (not the retired in-memory fullSession writes):
 *  - KPI add POSTs to /rollout/kpis and renders the returned row
 *  - KPI delete calls DELETE /rollout/kpis/:id
 *  - load failure surfaces the HubWorkAreaLoadError retry state
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) {
        let out = String(opts.defaultValue);
        if (opts.count != null) out = out.replace('{{count}}', String(opts.count));
        if (opts.topSignal != null) out = out.replace('{{topSignal}}', String(opts.topSignal));
        return out;
      }
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const { apiGet, apiPost, apiPatch, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete },
}));

import { RolloutTab } from '../RolloutTab';

const emptyLists = () => {
  apiGet.mockImplementation((url: string) => {
    if (url.includes('/rollout/kpis')) return Promise.resolve({ data: { kpis: [] } });
    if (url.includes('/rollout/risks')) return Promise.resolve({ data: { risks: [] } });
    if (url.includes('/rollout/changes')) return Promise.resolve({ data: { changes: [] } });
    if (url.includes('/rollout/closures')) return Promise.resolve({ data: { closures: [] } });
    return Promise.resolve({ data: {} });
  });
};

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPatch.mockReset();
  apiDelete.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('RolloutTab smoke', () => {
  it('renders the KPI empty state after loading', async () => {
    emptyLists();
    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Add KPI')).toBeInTheDocument();
    });
    // Fetched all four sub-resources from the real API.
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('/rollout/kpis'));
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('/rollout/risks'));
  });

  it('add KPI POSTs to /rollout/kpis and shows the returned row', async () => {
    emptyLists();
    apiPost.mockResolvedValue({
      data: {
        kpi: { id: 'k1', name: 'NPS', baseline: 0, target: 100, current_value: 20, unit: '%' },
      },
    });

    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => expect(screen.getByText('Add KPI')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add KPI'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/rollout/kpis', { projectId: 'proj-1' });
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue('NPS')).toBeInTheDocument();
    });
  });

  it('delete KPI calls DELETE /rollout/kpis/:id', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/rollout/kpis'))
        return Promise.resolve({
          data: {
            kpis: [
              { id: 'k1', name: 'NPS', baseline: 0, target: 100, current_value: 20, unit: '%' },
            ],
          },
        });
      if (url.includes('/rollout/risks')) return Promise.resolve({ data: { risks: [] } });
      if (url.includes('/rollout/changes')) return Promise.resolve({ data: { changes: [] } });
      if (url.includes('/rollout/closures')) return Promise.resolve({ data: { closures: [] } });
      return Promise.resolve({ data: {} });
    });
    apiDelete.mockResolvedValue({ data: { success: true } });

    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => expect(screen.getByDisplayValue('NPS')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/rollout/kpis/k1');
    });
  });

  it('surfaces the load-error retry state when the fetch fails', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Could not load rollout data')).toBeInTheDocument();
    });
  });
});
