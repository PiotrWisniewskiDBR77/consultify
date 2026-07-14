/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AICoreRuntimePanel } from '../../../../../src/views/superadmin/components/AI/AICoreRuntimePanel';
import { V8AICoreApi } from '../../../../../src/services/api/v8/ai-core';

vi.mock('../../../../../src/services/api/v8/ai-core', () => ({
  V8AICoreApi: {
    getEnvironment: vi.fn(),
    getTools: vi.fn(),
    getToolPolicy: vi.fn(),
    getAuditTrail: vi.fn(),
    getProvenance: vi.fn(),
  },
}));

describe('AICoreRuntimePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads governed AI core environment and tool catalog', async () => {
    vi.mocked(V8AICoreApi.getEnvironment).mockResolvedValue({
      healthy: true,
      contract: 'ai_core_v1',
      layers: {
        context: 'healthy',
        retrieval: 'healthy',
        execution: 'degraded',
      },
    } as any);
    vi.mocked(V8AICoreApi.getTools).mockResolvedValue([
      { toolId: 'tool-1', name: 'Report Generator', category: 'documents' },
      { toolId: 'tool-2', name: 'Deck Builder', category: 'presentations' },
    ] as any);
    vi.mocked(V8AICoreApi.getToolPolicy).mockResolvedValue({
      tool: { toolId: 'tool-1', name: 'Report Generator' },
      effectivePolicy: {
        state: 'allowed',
        approvalClass: 'auto_executable',
        allowed: true,
        approvalOverride: 'inherit_from_tool',
        maxInvocationsPerRun: 3,
        policyRef: 'policy-1',
        blockReason: null,
      },
    } as any);

    render(<AICoreRuntimePanel />);

    expect(await screen.findByText('AI core runtime (V8)')).toBeInTheDocument();
    expect(screen.getByText('ai_core_v1')).toBeInTheDocument();
    expect(screen.getByText('Report Generator')).toBeInTheDocument();
    expect(screen.getByText('Deck Builder')).toBeInTheDocument();
    expect(screen.getByText('execution')).toBeInTheDocument();
    expect(screen.getByText('degraded')).toBeInTheDocument();
    await waitFor(() => {
      expect(V8AICoreApi.getEnvironment).toHaveBeenCalledTimes(1);
      expect(V8AICoreApi.getTools).toHaveBeenCalledTimes(1);
      expect(V8AICoreApi.getToolPolicy).toHaveBeenCalledWith('tool-1', 'chat');
    });
    expect(screen.getByText('Tool policy readback')).toBeInTheDocument();
    expect(screen.getByText('auto_executable')).toBeInTheDocument();
    expect(screen.getByText('policy-1')).toBeInTheDocument();
  });

  it('loads a new policy when a different governed tool is selected', async () => {
    vi.mocked(V8AICoreApi.getEnvironment).mockResolvedValue({
      healthy: true,
      contract: 'ai_core_v1',
      layers: {},
    } as any);
    vi.mocked(V8AICoreApi.getTools).mockResolvedValue([
      { toolId: 'tool-1', name: 'Report Generator', category: 'documents' },
      { toolId: 'tool-2', name: 'Deck Builder', category: 'presentations' },
    ] as any);
    vi.mocked(V8AICoreApi.getToolPolicy)
      .mockResolvedValueOnce({
        tool: { toolId: 'tool-1', name: 'Report Generator' },
        effectivePolicy: {
          state: 'allowed',
          approvalClass: 'auto_executable',
          allowed: true,
        },
      } as any)
      .mockResolvedValueOnce({
        tool: { toolId: 'tool-2', name: 'Deck Builder' },
        effectivePolicy: {
          state: 'requires_approval',
          approvalClass: 'requires_human_approval',
          allowed: true,
          approvalOverride: 'force_human_approval',
        },
      } as any);

    render(<AICoreRuntimePanel />);

    expect(await screen.findByText('auto_executable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Deck Builder/i }));

    await waitFor(() => {
      expect(V8AICoreApi.getToolPolicy).toHaveBeenLastCalledWith('tool-2', 'chat');
    });
    expect(screen.getByText('requires_human_approval')).toBeInTheDocument();
    expect(screen.getByText('force_human_approval')).toBeInTheDocument();
  });

  it('loads governed trust and provenance readback for a snapshot id', async () => {
    vi.mocked(V8AICoreApi.getEnvironment).mockResolvedValue({
      healthy: true,
      contract: 'ai_core_v1',
      layers: {},
    } as any);
    vi.mocked(V8AICoreApi.getTools).mockResolvedValue([] as any);
    vi.mocked(V8AICoreApi.getToolPolicy).mockResolvedValue(null as any);
    vi.mocked(V8AICoreApi.getAuditTrail).mockResolvedValue({
      supportTraces: [{ id: 'trace-1', toolName: 'ChatTurn', stage: 'execution', status: 'done' }],
      provenanceEntries: [],
    } as any);
    vi.mocked(V8AICoreApi.getProvenance).mockResolvedValue({
      snapshotId: 'snapshot-123',
      lineage: [{ id: 'prov-1', kind: 'artifact', label: 'Generated summary' }],
    } as any);

    render(<AICoreRuntimePanel />);

    fireEvent.change(await screen.findByLabelText('Snapshot id'), {
      target: { value: 'snapshot-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load trust' }));

    await waitFor(() => {
      expect(V8AICoreApi.getAuditTrail).toHaveBeenCalledWith('snapshot-123');
      expect(V8AICoreApi.getProvenance).toHaveBeenCalledWith('snapshot-123');
    });

    expect(screen.getByText('Trust and provenance readback')).toBeInTheDocument();
    expect(screen.getByText('ChatTurn')).toBeInTheDocument();
    expect(screen.getByText('execution · done')).toBeInTheDocument();
    expect(screen.getByText('Generated summary')).toBeInTheDocument();
    expect(screen.getByText('artifact')).toBeInTheDocument();
  });
});
