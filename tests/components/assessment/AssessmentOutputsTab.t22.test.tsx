/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listOutputsMock, getOutputMock, isAuthErrorMock } = vi.hoisted(() => ({
  listOutputsMock: vi.fn(), getOutputMock: vi.fn(), isAuthErrorMock: vi.fn(() => false),
}));
vi.mock('@/method-core/api/methodCoreApi', () => ({
  listOutputs: listOutputsMock, getOutput: getOutputMock, isAuthError: isAuthErrorMock,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (_key: string, fallback?: unknown) => typeof fallback === 'string' ? fallback : _key,
  i18n: { language: 'en' },
}) }));
import { AssessmentOutputsTab } from '../../../src/components/assessment/AssessmentOutputsTab';

const OUTPUT = {
  id: 'out-1', organizationId: 'org-1', sessionId: 'session-1', module: 'assessment',
  methodPackId: 'drd', methodPackVersion: '2.0.0', outputVersion: 3,
  revisionOfOutputId: null, scope: 'DRD readiness output', limitationsCount: 1,
  findingsCount: 1, contentHash: 'abcdef1234567890', frozenAt: '2026-08-23T06:00:00.000Z',
  createdAt: '2026-08-23T06:00:00.000Z', demoBypassActive: false,
  isSuperseded: false, supersededByOutputId: null,
} as const;
const DETAIL = { output: {
  id: OUTPUT.id, organizationId: 'org-1', sessionId: 'session-1', module: 'assessment',
  methodPackId: 'drd', methodPackVersion: '2.0.0', outputVersion: 3, scope: OUTPUT.scope,
  current: { '1A': 2 }, target: { '1A': 4 }, gap: { '1A': 2 },
  limitations: ['Evidence incomplete'], findings: [{ id: 'f-1', unitId: '1A', unitName: 'Sales',
    currentLevel: 2, targetLevel: 4, gap: 2, businessMeaning: 'Meaning', recommendation: 'Improve' }],
  contentHash: OUTPUT.contentHash, frozenAt: OUTPUT.frozenAt,
}, superseded: false, supersededByOutputId: null } as const;

describe('T22 AssessmentOutputsTab — Method Core contract', () => {
  beforeEach(() => {
    vi.clearAllMocks(); isAuthErrorMock.mockReturnValue(false);
    listOutputsMock.mockResolvedValue({ outputs: [OUTPUT], total: 1 });
    getOutputMock.mockResolvedValue(DETAIL);
  });
  it('reads Method Core and keeps only assessment outputs', async () => {
    const onCountChange = vi.fn();
    listOutputsMock.mockResolvedValue({ outputs: [OUTPUT, { ...OUTPUT, id: 'tools-1', module: 'tools' }], total: 2 });
    render(<AssessmentOutputsTab onCountChange={onCountChange} />);
    expect(await screen.findByText('DRD readiness output')).toBeInTheDocument();
    expect(listOutputsMock).toHaveBeenCalledWith();
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });
  it('shows truthful empty and reports zero', async () => {
    const onCountChange = vi.fn(); listOutputsMock.mockResolvedValue({ outputs: [], total: 0 });
    render(<AssessmentOutputsTab onCountChange={onCountChange} />);
    expect(await screen.findByText('No outputs yet')).toBeInTheDocument();
    expect(onCountChange).toHaveBeenLastCalledWith(0);
  });
  it('separates generic failure from empty and never leaks raw error data', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listOutputsMock.mockRejectedValue(new Error('Bearer SECRET at https://internal-db/sql SELECT'));
    render(<AssessmentOutputsTab />);
    expect(await screen.findByText('Failed to load Outputs. Please try again.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SECRET|internal-db|SELECT/);
    expect(consoleError).toHaveBeenCalledWith('[AssessmentOutputsTab] failed to load outputs');
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/SECRET|internal-db|SELECT/);
    consoleError.mockRestore();
  });
  it('shows dedicated forbidden state for an auth error', async () => {
    isAuthErrorMock.mockReturnValue(true); listOutputsMock.mockRejectedValue(new Error('forbidden'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<AssessmentOutputsTab />);
    expect(await screen.findByText('No access to Outputs')).toBeInTheDocument();
  });
  it('opens a row by re-fetching the immutable persisted snapshot', async () => {
    render(<AssessmentOutputsTab />); fireEvent.click(await screen.findByText('DRD readiness output'));
    await waitFor(() => expect(getOutputMock).toHaveBeenCalledWith('out-1'));
    expect(await screen.findByText(/frozen, immutable snapshot/i)).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('Limitations')).toBeInTheDocument();
  });
  it('offers lineage but no destructive invented action', async () => {
    render(<AssessmentOutputsTab />); fireEvent.click(await screen.findByText('DRD readiness output'));
    expect(await screen.findByRole('button', { name: 'View lineage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|duplicate|archive|export/i })).not.toBeInTheDocument();
  });
  it('does not add selection checkboxes or a Menu3 bulk row', async () => {
    const { container } = render(<AssessmentOutputsTab />); await screen.findByText('DRD readiness output');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(container.querySelector('[data-menu3-bulk]')).toBeNull();
  });
  it('retains the shared Outputs, Reports and Initiatives surfaces', async () => {
    render(<AssessmentOutputsTab />);
    expect(await screen.findByRole('tab', { name: 'Outputs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Initiatives' })).toBeInTheDocument();
  });
});
