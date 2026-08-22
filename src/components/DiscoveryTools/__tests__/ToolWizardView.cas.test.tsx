// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getToolSession, updateToolSession } = vi.hoisted(() => ({
  getToolSession: vi.fn(),
  updateToolSession: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { getToolSession, updateToolSession, promoteToolOutput: vi.fn() },
}));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('../ProcessAutomation', () => ({ ProcessMapWorkSurface: () => null }));
vi.mock('../../shared/ToolWizard', () => ({
  createEmptyWizardSession: (sessionId: string, toolType: string) => ({
    sessionId,
    toolType,
    status: 'DRAFT',
    locked: false,
    currentStep: 'define',
    define: { intent: '' },
    review: { missingItems: [], summaries: [] },
    outputs: [],
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
  }),
  getToolWizardConfig: () => ({ toolName: { en: 'Tool', pl: 'Tool' } }),
  ToolWizardShell: (props: {
    onSessionUpdate: (value: Record<string, unknown>) => void;
    onFinalize: () => Promise<void>;
  }) => (
    <div>
      <button onClick={() => props.onSessionUpdate({ currentStep: 'work' })}>save</button>
      <button onClick={() => void props.onFinalize()}>finalize</button>
    </div>
  ),
}));

import { ToolWizardView } from '../ToolWizardView';

describe('ToolWizardView CAS persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToolSession.mockResolvedValue({
      id: 'tool-1',
      status: 'DRAFT',
      version: 3,
      wizardState: {},
      missingItems: [],
    });
    updateToolSession
      .mockResolvedValueOnce({ id: 'tool-1', status: 'IN_PROGRESS', updatedAt: 'one', version: 4 })
      .mockResolvedValueOnce({ id: 'tool-1', status: 'FINALIZED', updatedAt: 'two', version: 5 });
  });

  it('serializes autosave and finalize using the version returned by each write', async () => {
    render(<ToolWizardView toolType="custom" sessionId="tool-1" onBack={vi.fn()} />);
    await screen.findByRole('button', { name: 'save' });

    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(updateToolSession).toHaveBeenCalledTimes(1));
    expect(updateToolSession.mock.calls[0][1]).toMatchObject({ expectedVersion: 3 });

    fireEvent.click(screen.getByRole('button', { name: 'finalize' }));
    await waitFor(() => expect(updateToolSession).toHaveBeenCalledTimes(2));
    expect(updateToolSession.mock.calls[1][1]).toMatchObject({
      status: 'FINALIZED',
      expectedVersion: 4,
    });
  });
});
