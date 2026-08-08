import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { snapshotMock, templatesMock, governanceMock } = vi.hoisted(() => ({
  snapshotMock: vi.fn(),
  templatesMock: vi.fn(),
  governanceMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getAgentRunOperationalSnapshot: snapshotMock,
    recoverAgentRunTarget: vi.fn(),
    listAgentProcessTemplates: templatesMock,
    getAgentProcessTemplateGovernance: governanceMock,
    transitionAgentProcessTemplate: vi.fn(),
    instantiateAgentProcessTemplate: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

let language = 'pl';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language },
    t: (_key: string, fallback: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

import { AgentOperationsPanel } from '../AgentOperationsPanel';
import { AgentProcessTemplatesPanel } from '../AgentProcessTemplatesPanel';

describe('Agent UI accessibility contracts', () => {
  beforeEach(() => {
    language = 'pl';
    snapshotMock.mockReset().mockResolvedValue({
      correlationId: 'corr-1',
      run: { state: 'paused', goal: 'Transformacja operacyjna' },
      alerts: [
        {
          severity: 'critical',
          code: 'LEASE_EXPIRED',
          targetId: 'step-1',
          safeAction: 'recover_expired_lease',
        },
      ],
      metrics: { queueDepth: 1 },
      recoveries: [],
    });
    templatesMock.mockReset().mockResolvedValue([
      {
        id: 'template-1',
        key: 'transformation',
        title: 'Pełna transformacja',
        status: 'published',
        version: 2,
      },
    ]);
    governanceMock.mockReset().mockResolvedValue({ versions: [], events: [] });
  });

  it('submits diagnostics from the keyboard and exposes localized state semantics', async () => {
    render(<AgentOperationsPanel />);

    const input = screen.getByRole('textbox', {
      name: 'Kanoniczny identyfikator przebiegu',
    });
    fireEvent.change(input, { target: { value: 'run-1' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(snapshotMock).toHaveBeenCalledWith('run-1'));
    expect(screen.getByRole('status')).toHaveTextContent('Diagnostyka została wczytana.');
    expect(screen.getByRole('alert')).toHaveTextContent('Wygasła dzierżawa');
    expect(screen.getByRole('button', { name: 'Odśwież diagnostykę' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bezpieczne odzyskiwanie: Wygasła dzierżawa' })
    ).toBeInTheDocument();
  });

  it('binds the history control to a named expandable governance region', async () => {
    render(<AgentProcessTemplatesPanel />);

    const history = await screen.findByRole('button', { name: 'Historia' });
    expect(history).toHaveAttribute('aria-expanded', 'false');
    expect(history).toHaveAttribute('aria-controls', 'agent-template-template-1-history');

    fireEvent.click(history);

    expect(
      await screen.findByRole('region', { name: 'Historia governance: Pełna transformacja' })
    ).toBeInTheDocument();
    expect(history).toHaveAttribute('aria-expanded', 'true');
    expect(governanceMock).toHaveBeenCalledWith('template-1');
  });

  it('uses English accessible labels when the interface language is English', async () => {
    language = 'en';
    render(<AgentOperationsPanel initialCanonicalRunId="canonical-run-7" />);

    expect(screen.getByRole('textbox', { name: 'Canonical run ID' })).toHaveValue(
      'canonical-run-7'
    );
    expect(snapshotMock).not.toHaveBeenCalled();
  });
});
