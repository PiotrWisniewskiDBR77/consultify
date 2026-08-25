import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';

import { V8PromptOsApi } from '../../../services/api/v8/prompt-os';
import { AdminConfigurationVersionsPanel } from '../AdminConfigurationVersionsPanel';


// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/api/v8/prompt-os', () => ({
  V8PromptOsApi: {
    getRuntimeSummary: vi.fn(),
    getBundles: vi.fn(),
    getEvalGates: vi.fn(),
    getCanary: vi.fn(),
    activateBundle: vi.fn(),
    rollbackBundle: vi.fn(),
  },
}));

const bundle = {
  bundleId: 'b1',
  version: '1.2.3',
  presetId: 'p1',
  promptVersion: 'pv1',
  modelVersion: 'mv1',
  policyVersion: 'pol1',
  runtimeConfigVersion: 'rv1',
  status: 'active' as const,
};

describe('AdminConfigurationVersionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockResolvedValue({
      contract: 'v8',
      purposeFamiliesSupported: [],
      presetCount: 1,
      bundleCount: 1,
      activeBundleCount: 1,
    });
    vi.mocked(V8PromptOsApi.getBundles).mockResolvedValue([bundle]);
    vi.mocked(V8PromptOsApi.getEvalGates).mockResolvedValue([]);
    vi.mocked(V8PromptOsApi.getCanary).mockRejectedValue(
      Object.assign(new Error('CANARY_NOT_FOUND'), { status: 404 })
    );
  });

  it('renders real summary and bundles', async () => {
    render(<AdminConfigurationVersionsPanel />);
    expect(await screen.findByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('v8')).toBeInTheDocument();
  });

  it('distinguishes V8_DISABLED from a generic error', async () => {
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockRejectedValue(
      Object.assign(new Error('disabled'), { status: 404, data: { code: 'V8_DISABLED' } })
    );
    render(<AdminConfigurationVersionsPanel />);
    expect(
      await screen.findByText('Prompt OS nie jest włączony dla tej organizacji')
    ).toBeInTheDocument();
    expect(screen.queryByText('Spróbuj ponownie')).not.toBeInTheDocument();
  });

  it('requires a rollback reason and performs readback', async () => {
    vi.mocked(V8PromptOsApi.rollbackBundle).mockResolvedValue({});
    render(<AdminConfigurationVersionsPanel />);
    await screen.findByText('1.2.3');
    fireEvent.click(screen.getByLabelText('Akcje wiersza'));
    fireEvent.click(await screen.findByText('Wycofaj wersję'));
    const next = screen.getByText('Przejdź do potwierdzenia');
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Powód wycofania'), {
      target: { value: 'Regresja jakości' },
    });
    fireEvent.click(next);
    fireEvent.click(await screen.findByRole('button', { name: 'Wycofaj wersję' }));
    await waitFor(() =>
      expect(V8PromptOsApi.rollbackBundle).toHaveBeenCalledWith('b1', 'Regresja jakości')
    );
    expect(V8PromptOsApi.getBundles).toHaveBeenCalledTimes(2);
  });

  it('activates a draft and performs list readback', async () => {
    const draft = { ...bundle, status: 'draft' as const };
    vi.mocked(V8PromptOsApi.getBundles).mockResolvedValue([draft]);
    vi.mocked(V8PromptOsApi.activateBundle).mockResolvedValue({ ...draft, status: 'active' });
    render(<AdminConfigurationVersionsPanel />);
    await screen.findByText('1.2.3');
    fireEvent.click(screen.getByLabelText('Akcje wiersza'));
    fireEvent.click(await screen.findByText('Aktywuj'));
    await waitFor(() => expect(V8PromptOsApi.activateBundle).toHaveBeenCalledWith('b1'));
    expect(V8PromptOsApi.getBundles).toHaveBeenCalledTimes(2);
  });

  it('preserves the 409 conflict message after readback', async () => {
    const draft = { ...bundle, status: 'draft' as const };
    vi.mocked(V8PromptOsApi.getBundles).mockResolvedValue([draft]);
    vi.mocked(V8PromptOsApi.activateBundle).mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409 })
    );
    render(<AdminConfigurationVersionsPanel />);
    await screen.findByText('1.2.3');
    fireEvent.click(screen.getByLabelText('Akcje wiersza'));
    fireEvent.click(await screen.findByText('Aktywuj'));
    expect(await screen.findByText(/zmieniła się równolegle/)).toBeInTheDocument();
    expect(V8PromptOsApi.getBundles).toHaveBeenCalledTimes(2);
  });

  it('does not present a details failure as an empty state', async () => {
    vi.mocked(V8PromptOsApi.getEvalGates).mockRejectedValue(new Error('gate network failure'));
    render(<AdminConfigurationVersionsPanel />);
    await screen.findByText('1.2.3');
    fireEvent.click(screen.getByLabelText('Akcje wiersza'));
    fireEvent.click(await screen.findByText('Pokaż szczegóły'));
    expect(await screen.findByText('gate network failure')).toBeInTheDocument();
    expect(screen.queryByText('Bramki: brak wyników')).not.toBeInTheDocument();
  });
});
