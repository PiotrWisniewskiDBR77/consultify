import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptOsRuntimeSummaryPanel } from '@/views/superadmin/components/AI/PromptOsRuntimeSummaryPanel';
import { V8PromptOsApi } from '@/services/api/v8/prompt-os';

vi.mock('@/services/api/v8/prompt-os', () => ({
  V8PromptOsApi: {
    getRuntimeSummary: vi.fn(),
  },
}));

describe('PromptOsRuntimeSummaryPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockResolvedValue({
      contract: 'prompt-os-runtime-v8',
      purposeFamiliesSupported: ['chat', 'report_builder'],
      presetCount: 2,
      bundleCount: 1,
      activeBundleCount: 0,
    });
  });

  it('does not render failed runtime summary as zero prompt OS counters', async () => {
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockRejectedValue(new Error('Prompt OS down'));

    render(<PromptOsRuntimeSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Prompt OS runtime unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Prompt OS down')).toBeInTheDocument();
    expect(screen.queryByText('prompt-os-runtime-v8')).not.toBeInTheDocument();
    expect(screen.queryByText('Presets')).not.toBeInTheDocument();
    expect(screen.queryByText('Bundles')).not.toBeInTheDocument();
    expect(screen.queryByText('Active bundles')).not.toBeInTheDocument();
  });

  it('renders live Prompt OS counters from the V8 runtime summary endpoint', async () => {
    render(<PromptOsRuntimeSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText('prompt-os-runtime-v8')).toBeInTheDocument();
    });

    expect(screen.getByText(/chat, report_builder/)).toBeInTheDocument();
    expect(V8PromptOsApi.getRuntimeSummary).toHaveBeenCalledTimes(1);
  });

  it('accepts deep wrapped runtime summary payloads', async () => {
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockResolvedValue({
      data: {
        data: {
          contract: 'prompt-os-runtime-v8',
          purposeFamiliesSupported: ['chat'],
          presetCount: '2',
          bundleCount: '1',
          activeBundleCount: '0',
        },
      },
    } as never);

    render(<PromptOsRuntimeSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText('prompt-os-runtime-v8')).toBeInTheDocument();
    });
    expect(screen.queryByText('Prompt OS runtime unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed runtime summary as zero counters', async () => {
    vi.mocked(V8PromptOsApi.getRuntimeSummary).mockResolvedValue({
      contract: 'prompt-os-runtime-v8',
      purposeFamiliesSupported: { unexpected: true },
    } as never);

    render(<PromptOsRuntimeSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Prompt OS runtime unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Prompt OS runtime summary response was incomplete')).toBeInTheDocument();
    expect(screen.queryByText('Presets')).not.toBeInTheDocument();
  });
});
