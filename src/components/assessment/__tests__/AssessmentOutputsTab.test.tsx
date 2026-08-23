/**
 * @vitest-environment jsdom
 *
 * P0D — AssessmentOutputsTab reads the method-core kernel
 * (`listOutputs`/`getOutput`), NOT the legacy `/api/artifacts` registry.
 * Covers: StandardTable rendering, current/superseded distinction,
 * snapshot-not-session-state on open, lineage hand-off, empty/error/
 * forbidden states, and canonical sibling-surface navigation.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listOutputs: vi.fn(),
  getOutput: vi.fn(),
  listReports: vi.fn(),
  getReportSnapshot: vi.fn(),
  listInitiativeDrafts: vi.fn(),
  getInitiativeDraft: vi.fn(),
  getSessionLineage: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    listOutputs: hoisted.listOutputs,
    getOutput: hoisted.getOutput,
    listReports: hoisted.listReports,
    getReportSnapshot: hoisted.getReportSnapshot,
    listInitiativeDrafts: hoisted.listInitiativeDrafts,
    getInitiativeDraft: hoisted.getInitiativeDraft,
    getSessionLineage: hoisted.getSessionLineage,
  };
});

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';

import { AssessmentOutputsTab } from '../AssessmentOutputsTab';

function outputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'out-1',
    organizationId: 'org-1',
    sessionId: 'sess-1',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '2.0',
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: 'Digital Readiness — Area A',
    limitationsCount: 1,
    findingsCount: 3,
    contentHash: 'abcdef1234567890',
    frozenAt: '2026-08-10T10:00:00.000Z',
    createdAt: '2026-08-10T10:00:00.000Z',
    demoBypassActive: false,
    isSuperseded: null,
    supersededByOutputId: null,
    ...overrides,
  };
}

function outputDetail(overrides: Record<string, unknown> = {}) {
  return {
    output: {
      id: 'out-1',
      organizationId: 'org-1',
      sessionId: 'sess-1',
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '2.0',
      outputVersion: 1,
      scope: 'Digital Readiness — Area A',
      current: {},
      target: {},
      gap: {},
      limitations: ['Sample size limited to 3 interviews'],
      findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }],
      contentHash: 'abcdef1234567890',
      frozenAt: '2026-08-10T10:00:00.000Z',
    },
    superseded: false,
    supersededByOutputId: null,
    ...overrides,
  };
}

describe('AssessmentOutputsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getOutput.mockResolvedValue(outputDetail());
    hoisted.listReports.mockResolvedValue([]);
    hoisted.listInitiativeDrafts.mockResolvedValue([]);
  });

  it('renders the kernel Outputs list via StandardTable, not the legacy artifacts registry', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });

    render(<AssessmentOutputsTab />);

    expect(await screen.findByText('Digital Readiness — Area A')).toBeInTheDocument();
    expect(hoisted.listOutputs).toHaveBeenCalledTimes(1);
  });

  it('reports the count back to the parent via onCountChange', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [outputRow(), outputRow({ id: 'out-2' })],
      total: 2,
    });
    const onCountChange = vi.fn();

    render(<AssessmentOutputsTab onCountChange={onCountChange} />);

    await waitFor(() => {
      expect(onCountChange).toHaveBeenCalledWith(2);
    });
  });

  it('excludes Method Core outputs owned by Tools or Audits from the Assessment surface', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        outputRow(),
        outputRow({ id: 'tool-output', module: 'tools', scope: 'Tool output' }),
        outputRow({ id: 'audit-output', module: 'audits', scope: 'Audit output' }),
      ],
      total: 3,
    });
    const onCountChange = vi.fn();

    render(<AssessmentOutputsTab onCountChange={onCountChange} />);

    expect(await screen.findByText('Digital Readiness — Area A')).toBeInTheDocument();
    expect(screen.queryByText('Tool output')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit output')).not.toBeInTheDocument();
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it('visually distinguishes a current Output from a superseded one', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        outputRow({ id: 'out-1', outputVersion: 1, isSuperseded: true, scope: 'Old revision' }),
        outputRow({
          id: 'out-2',
          outputVersion: 2,
          isSuperseded: false,
          revisionOfOutputId: 'out-1',
          scope: 'New revision',
        }),
      ],
      total: 2,
    });

    render(<AssessmentOutputsTab />);

    await screen.findByText('Old revision');
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('derives superseded status from revisionOfOutputId links when the list row omits isSuperseded', async () => {
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        outputRow({ id: 'out-1', outputVersion: 1, isSuperseded: null, scope: 'Older' }),
        outputRow({
          id: 'out-2',
          outputVersion: 2,
          isSuperseded: null,
          revisionOfOutputId: 'out-1',
          scope: 'Newer',
        }),
      ],
      total: 2,
    });

    render(<AssessmentOutputsTab />);

    await screen.findByText('Older');
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('opening a row fetches the immutable server snapshot (getOutput) rather than deriving from session state', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    const user = userEvent.setup();

    render(<AssessmentOutputsTab />);
    await screen.findByText('Digital Readiness — Area A');

    await user.click(screen.getByText('Digital Readiness — Area A'));

    await waitFor(() => {
      expect(hoisted.getOutput).toHaveBeenCalledWith('out-1');
    });
    // Findings count in the preview comes from the FETCHED detail (3 findings),
    // proving the properties table is driven by the server snapshot.
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows an honest empty state with an explanation when there are no Outputs', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [], total: 0 });

    render(<AssessmentOutputsTab />);

    expect(await screen.findByText('No insights yet')).toBeInTheDocument();
    expect(
      screen.getByText('Insights frozen from a completed assessment session will appear here.')
    ).toBeInTheDocument();
  });

  it('shows an error state with retry when the Outputs list fails to load', async () => {
    hoisted.listOutputs.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();

    render(<AssessmentOutputsTab />);

    expect(
      await screen.findByText('Failed to load Insights. Please try again.')
    ).toBeInTheDocument();

    hoisted.listOutputs.mockResolvedValueOnce({ outputs: [outputRow()], total: 1 });
    // Accessible name is "Try again" (i18n `common.retry`), not "Retry" — the
    // EmptyState error CTA was deliberately moved off a hardcoded English
    // "Retry" label onto this translated copy (see R09-1 in
    // AssessmentOutputsTab.tsx's module doc comment); the selector below was
    // never updated to match, which is why this assertion — not the retry
    // affordance itself — was the actual reason this test stayed red.
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Digital Readiness — Area A')).toBeInTheDocument();
    });
  });

  it('shows a distinct "no access" state (not just an empty list) on a 403', async () => {
    hoisted.listOutputs.mockRejectedValueOnce(new MethodCoreApiError('Forbidden', 403, {}));

    render(<AssessmentOutputsTab />);

    expect(await screen.findByText('No access to Insights')).toBeInTheDocument();
    expect(screen.queryByText('No insights yet')).not.toBeInTheDocument();
  });

  it('hands Reports navigation to the canonical parent surface instead of rendering a duplicate menu', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<AssessmentOutputsTab onNavigate={onNavigate} />);
    await user.click(await screen.findByText('Digital Readiness — Area A'));
    await screen.findByText('3'); // preview loaded

    const reportsRelation = screen.getByRole('button', { name: 'Reports' });
    await user.click(reportsRelation);

    expect(onNavigate).toHaveBeenCalledWith('reports');
    expect(hoisted.listReports).not.toHaveBeenCalled();
  });

  it('"View lineage" swaps the aside for ArtifactLineagePanel, fetching the session lineage', async () => {
    hoisted.listOutputs.mockResolvedValue({ outputs: [outputRow()], total: 1 });
    hoisted.getSessionLineage.mockResolvedValue({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [],
      reports: [],
      presentations: [],
      initiativeDrafts: [],
    });
    const user = userEvent.setup();

    render(<AssessmentOutputsTab />);
    await user.click(await screen.findByText('Digital Readiness — Area A'));
    await screen.findByText('3');

    await user.click(screen.getByRole('button', { name: 'View lineage' }));

    await waitFor(() => {
      expect(hoisted.getSessionLineage).toHaveBeenCalledWith('sess-1');
    });
    expect(await screen.findByText('Lineage')).toBeInTheDocument();
  });
});
