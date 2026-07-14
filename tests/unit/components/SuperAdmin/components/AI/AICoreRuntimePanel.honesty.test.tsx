import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AICoreRuntimePanel } from '@/views/superadmin/components/AI/AICoreRuntimePanel';
import { V8AICoreApi } from '@/services/api/v8/ai-core';

vi.mock('@/services/api/v8/ai-core', () => ({
  V8AICoreApi: {
    getEnvironment: vi.fn(),
    getTools: vi.fn(),
    getToolPolicy: vi.fn(),
    getAuditTrail: vi.fn(),
    getProvenance: vi.fn(),
  },
}));

describe('AICoreRuntimePanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8AICoreApi.getEnvironment).mockResolvedValue({
      healthy: true,
      contract: 'ai_core_v1',
      layers: { execution: 'healthy' },
    });
    vi.mocked(V8AICoreApi.getTools).mockResolvedValue([
      { toolId: 'tool-1', name: 'Report Generator', category: 'documents' },
    ]);
    vi.mocked(V8AICoreApi.getToolPolicy).mockResolvedValue({
      effectivePolicy: {
        state: 'allowed',
        approvalClass: 'auto_executable',
        allowed: true,
      },
    });
  });

  it('does not render runtime load failures as an empty tool catalog', async () => {
    vi.mocked(V8AICoreApi.getEnvironment).mockRejectedValue(new Error('Runtime API down'));

    render(<AICoreRuntimePanel />);

    await waitFor(() => {
      expect(screen.getByText('AI core runtime unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Runtime API down')).toBeInTheDocument();
    expect(screen.queryByText('No governed tools returned.')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a governed tool to read its effective policy.')).not.toBeInTheDocument();
    expect(screen.queryByText('Trust and provenance readback')).not.toBeInTheDocument();
  });

  it('loads environment, tools, and first policy from live V8 endpoints', async () => {
    render(<AICoreRuntimePanel />);

    await waitFor(() => {
      expect(screen.getByText('ai_core_v1')).toBeInTheDocument();
    });

    expect(screen.getByText('Report Generator')).toBeInTheDocument();
    expect(screen.getByText('auto_executable')).toBeInTheDocument();
    expect(V8AICoreApi.getEnvironment).toHaveBeenCalledTimes(1);
    expect(V8AICoreApi.getTools).toHaveBeenCalledTimes(1);
    expect(V8AICoreApi.getToolPolicy).toHaveBeenCalledWith('tool-1', 'chat');
  });

  it('accepts deep wrapped runtime and policy payloads', async () => {
    vi.mocked(V8AICoreApi.getEnvironment).mockResolvedValue({
      data: {
        data: {
          healthy: 'true',
          contract: 'ai_core_v1',
          layers: { execution: 'healthy' },
        },
      },
    } as never);
    vi.mocked(V8AICoreApi.getTools).mockResolvedValue({
      data: {
        data: [{ toolId: 'tool-1', name: 'Report Generator', category: 'documents' }],
      },
    } as never);
    vi.mocked(V8AICoreApi.getToolPolicy).mockResolvedValue({
      data: {
        data: {
          effectivePolicy: {
            state: 'allowed',
            approvalClass: 'auto_executable',
            allowed: 'true',
          },
        },
      },
    } as never);

    render(<AICoreRuntimePanel />);

    await waitFor(() => {
      expect(screen.getByText('ai_core_v1')).toBeInTheDocument();
    });
    expect(screen.getByText('Report Generator')).toBeInTheDocument();
    expect(screen.getByText('auto_executable')).toBeInTheDocument();
  });

  it('does not render malformed tools payload as an empty catalog', async () => {
    vi.mocked(V8AICoreApi.getTools).mockResolvedValue({ unexpected: true } as never);

    render(<AICoreRuntimePanel />);

    await waitFor(() => {
      expect(screen.getByText('AI core runtime unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('AI core tools response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No governed tools returned.')).not.toBeInTheDocument();
  });
});
