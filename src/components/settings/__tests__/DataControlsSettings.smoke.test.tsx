/**
 * @vitest-environment jsdom
 *
 * Smoke tests for DataControlsSettings — covers the GDPR export flow and the
 * sample/demo-data toggle surfaced inside Settings (audit requirement: Settings
 * must consistently expose the demo toggle that lives in the profile menu).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: unknown) => {
      if (typeof def === 'string') return def;
      if (def && typeof def === 'object') {
        return (def as { defaultValue?: string }).defaultValue ?? _k;
      }
      return _k;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/shared/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title }: { title?: string }) => <div role="alert">{title}</div>,
}));

const { toggleDemoMode } = vi.hoisted(() => ({ toggleDemoMode: vi.fn(async () => ({})) }));
const demoState = vi.hoisted(() => ({ value: { isDemoMode: false } as { isDemoMode: boolean } }));

vi.mock('@/hooks/useDemo', () => ({
  useDemo: () => ({
    isDemoMode: demoState.value.isDemoMode,
    demoOrganization: demoState.value.isDemoMode ? { id: 'demo-1', name: 'Atelier Toys' } : null,
    isDemoLoading: false,
    toggleDemoMode,
  }),
}));

const { requestGdprExport, getGdprExportStatus, apiGet } = vi.hoisted(() => ({
  requestGdprExport: vi.fn(),
  getGdprExportStatus: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    getGdprConsents: vi.fn(async () => ({ consents: { analytics: true } })),
    getGdprRetention: vi.fn(async () => ({ retention: { period: '365', autoDelete: false } })),
    requestGdprExport,
    getGdprExportStatus,
    getGdprDeletionStatus: vi.fn(async () => ({ request: null })),
    cancelGdprDeletion: vi.fn(),
    requestGdprDeletion: vi.fn(async () => ({})),
  },
}));

import { DataControlsSettings } from '../DataControlsSettings';

const currentUser = { id: 'user-1', email: 't@e.com', firstName: 'T', lastName: 'U' } as never;

beforeEach(() => {
  toggleDemoMode.mockClear();
  requestGdprExport.mockReset();
  getGdprExportStatus.mockReset();
  apiGet.mockReset();
  demoState.value.isDemoMode = false;
  requestGdprExport.mockResolvedValue({ request: { id: 'req-1', status: 'ready' } });
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DataControlsSettings smoke', () => {
  it('renders the sample workspace demo toggle and triggers toggleDemoMode', async () => {
    render(<DataControlsSettings currentUser={currentUser} />);
    const toggleLabel = await screen.findByText('Explore the sample workspace');
    expect(toggleLabel).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    // The last switch is the demo toggle (after the consent toggles).
    fireEvent.click(switches[switches.length - 1]);
    await waitFor(() => expect(toggleDemoMode).toHaveBeenCalledTimes(1));
    expect(toggleDemoMode).toHaveBeenCalledWith(undefined, { source: 'settings_data_controls' });
  });

  it('requests a GDPR data export when the export button is clicked', async () => {
    render(<DataControlsSettings currentUser={currentUser} />);
    // Confirm the portability section loaded, then click the export action button.
    await screen.findByText('Export Your Data');
    const exportBtn = screen.getByRole('button', { name: /Request Export/i });
    fireEvent.click(exportBtn);
    await waitFor(() => expect(requestGdprExport).toHaveBeenCalledTimes(1));
  });
});
