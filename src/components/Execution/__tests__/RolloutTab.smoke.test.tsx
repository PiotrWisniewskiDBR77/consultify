/**
 * @vitest-environment jsdom
 *
 * Smoke tests for RolloutTab (Module 06 Realizacja — rollout consolidation).
 *
 * Verifies the rollout sub-resources are backed by real /api/rollout/* calls
 * (not the retired in-memory fullSession writes), AND that the canon §27 refactor
 * (M14/L-06, `5cdf90acdc`) behaves correctly — rows are read-only, edits route
 * through the kebab → modal, deletes through the kebab → confirm dialog:
 *  - KPI add POSTs to /rollout/kpis and renders the returned row as read-only text
 *  - KPI edit opens RolloutRegisterEditModal and PATCHes the minimal diff
 *  - KPI delete goes kebab → confirm → DELETE /rollout/kpis/:id
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
      // KPI section heading is always visible in the KPI subview
      expect(screen.getByText('KPI Tracking')).toBeInTheDocument();
    });
    // Fetched all four sub-resources from the real API.
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('/rollout/kpis'));
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('/rollout/risks'));
  });

  it('DEC-120/A4: never offers the fake "Load Atelier Toys example" seed button on an empty KPI register', async () => {
    emptyLists();
    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => {
      expect(screen.getByText('KPI Tracking')).toBeInTheDocument();
    });
    // The empty state must be an honest message, not a CTA that fires 5
    // hardcoded POSTs of fake data into the real API as its primary action.
    expect(screen.queryByText(/Atelier Toys/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Atelier/i })).not.toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('add KPI POSTs to /rollout/kpis and shows the returned row as read-only text', async () => {
    emptyLists();
    apiPost.mockResolvedValue({
      data: {
        kpi: { id: 'k1', name: 'NPS', baseline: 0, target: 100, current_value: 20, unit: '%' },
      },
    });

    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => expect(screen.getByText('KPI Tracking')).toBeInTheDocument());

    // RolloutTab wires addKpi via the execution:add-kpi window event dispatched by ExecutionHub.
    fireEvent(window, new CustomEvent('execution:add-kpi'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/rollout/kpis', { projectId: 'proj-1' });
    });
    // Canon §27: the name now renders as a read-only table cell (text), NOT an
    // editable <input> — so there is no display value, just visible text.
    await waitFor(() => {
      expect(screen.getByText('NPS')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('NPS')).not.toBeInTheDocument();
  });

  const seededKpiList = () => {
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
  };

  it('edit KPI opens the modal and PATCHes the minimal diff to /rollout/kpis/:id', async () => {
    seededKpiList();
    apiPatch.mockResolvedValue({
      data: {
        kpi: { id: 'k1', name: 'NPS v2', baseline: 0, target: 100, current_value: 20, unit: '%' },
      },
    });

    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => expect(screen.getByText('NPS')).toBeInTheDocument());

    // Canon §27: edit is behind the row kebab → "Edit" → modal.
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(await screen.findByText('Edit'));

    // Modal opens, seeded from the row (name is now an editable input inside it).
    const nameInput = await screen.findByDisplayValue('NPS');
    fireEvent.change(nameInput, { target: { value: 'NPS v2' } });
    fireEvent.click(screen.getByText('Save'));

    // Only the changed field is sent (minimal diff).
    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith('/rollout/kpis/k1', { name: 'NPS v2' });
    });
  });

  it('delete KPI goes kebab → confirm dialog → DELETE /rollout/kpis/:id', async () => {
    seededKpiList();
    apiDelete.mockResolvedValue({ data: { success: true } });

    render(<RolloutTab projectId="proj-1" initiatives={[]} />);
    await waitFor(() => expect(screen.getByText('NPS')).toBeInTheDocument());

    // Canon §27: delete is behind the kebab and guarded by a confirm dialog.
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(await screen.findByText('Delete'));

    // Confirm dialog appears; nothing deleted until the user confirms.
    const confirmDialogTitle = await screen.findByText('Delete this item?');
    expect(confirmDialogTitle).toBeInTheDocument();
    expect(apiDelete).not.toHaveBeenCalled();

    // The dialog's confirm button carries the common.delete label.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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
