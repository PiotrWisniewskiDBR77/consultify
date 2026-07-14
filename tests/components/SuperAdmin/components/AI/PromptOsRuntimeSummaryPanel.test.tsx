/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../../../../i18n';
import { PromptOsRuntimeSummaryPanel } from '../../../../../src/views/superadmin/components/AI/PromptOsRuntimeSummaryPanel';
import { V8PromptOsApi } from '../../../../../src/services/api/v8/prompt-os';

vi.mock('../../../../../src/services/api/v8/prompt-os', () => ({
  V8PromptOsApi: {
    getRuntimeSummary: vi.fn(),
  },
}));

const sampleSummary = {
  contract: 'prompt-os-runtime-v8',
  purposeFamiliesSupported: ['chat', 'report_builder'] as const,
  presetCount: 2,
  bundleCount: 1,
  activeBundleCount: 0,
};

function renderPanel() {
  return render(
    <I18nextProvider i18n={i18n}>
      <PromptOsRuntimeSummaryPanel />
    </I18nextProvider>,
  );
}

describe('PromptOsRuntimeSummaryPanel', () => {
  beforeEach(() => {
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockResolvedValue(sampleSummary);
  });

  it('renders runtime summary from V8PromptOsApi.getRuntimeSummary', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('prompt-os-runtime-v8')).toBeInTheDocument();
    });
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/chat, report_builder/)).toBeInTheDocument();
    expect(V8PromptOsApi.getRuntimeSummary).toHaveBeenCalledTimes(1);
  });

  it('reloads when Refresh is clicked', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(V8PromptOsApi.getRuntimeSummary).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(V8PromptOsApi.getRuntimeSummary).toHaveBeenCalledTimes(2));
  });

  it('shows error when getRuntimeSummary rejects', async () => {
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockRejectedValueOnce(new Error('network down'));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Prompt OS runtime unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('network down')).toBeInTheDocument();
  });
});
