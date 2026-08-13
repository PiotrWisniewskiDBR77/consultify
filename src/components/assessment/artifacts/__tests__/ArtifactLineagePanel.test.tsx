/**
 * @vitest-environment jsdom
 *
 * P0D — ArtifactLineagePanel renders `GET /api/method/sessions/:id/lineage`
 * (session -> revisions -> Output -> Report/Presentation -> Initiative
 * Proposal): the "full history after a restart" surface. Since the
 * endpoint's response shape was not agreed at field level when this was
 * written, `normalizeLineage` tries multiple plausible shapes — these tests
 * cover the named-array envelope, the flat `{nodes}` shape, an
 * unrecognized shape (honest error, not fabricated structure), and the
 * loading/error/forbidden states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSessionLineage: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    getSessionLineage: hoisted.getSessionLineage,
  };
});

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';

import { ArtifactLineagePanel, normalizeLineage } from '../ArtifactLineagePanel';

describe('normalizeLineage (pure)', () => {
  it('accepts the named-array envelope shape', () => {
    const result = normalizeLineage(
      {
        session: { id: 'sess-1', label: 'Session A' },
        outputs: [{ id: 'out-1', outputVersion: 1, status: 'current', frozenAt: '2026-08-10T10:00:00.000Z' }],
        reports: [{ id: 'r-1', title: 'Report 1' }],
        presentations: [],
        initiativeDrafts: [],
      },
      'sess-1'
    );
    expect(result?.session?.label).toBe('Session A');
    expect(result?.outputs).toHaveLength(1);
    expect(result?.reports).toHaveLength(1);
  });

  it('accepts a flat {nodes:[{kind,...}]} shape, grouping by kind', () => {
    const result = normalizeLineage(
      {
        nodes: [
          { kind: 'session', id: 'sess-1', label: 'Session A' },
          { kind: 'output', id: 'out-1', outputVersion: 1, status: 'current' },
          { kind: 'initiative_draft', id: 'draft-1', title: 'Draft 1' },
        ],
      },
      'sess-1'
    );
    expect(result?.outputs).toHaveLength(1);
    expect(result?.initiativeDrafts).toHaveLength(1);
    expect(result?.reports).toHaveLength(0);
  });

  it('returns null (unrecognized) for a shape with no known keys at all', () => {
    const result = normalizeLineage({ unexpectedField: 42 }, 'sess-1');
    expect(result).toBeNull();
  });

  it('returns null for a non-object body', () => {
    expect(normalizeLineage('just a string', 'sess-1')).toBeNull();
    expect(normalizeLineage(null, 'sess-1')).toBeNull();
  });
});

describe('ArtifactLineagePanel (component)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the full chain — session, outputs, reports, presentations, initiative proposals', async () => {
    hoisted.getSessionLineage.mockResolvedValue({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [{ id: 'out-1', outputVersion: 1, status: 'current', frozenAt: '2026-08-10T10:00:00.000Z' }],
      reports: [{ id: 'r-1', title: 'Q3 report', createdAt: '2026-08-10T10:00:00.000Z' }],
      presentations: [{ id: 'p-1', title: 'Board deck', createdAt: '2026-08-10T10:00:00.000Z' }],
      initiativeDrafts: [{ id: 'd-1', title: 'Automate intake', createdAt: '2026-08-10T10:00:00.000Z' }],
    });

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={vi.fn()} />);

    expect(await screen.findByText('Session sess-1')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('Q3 report')).toBeInTheDocument();
    expect(screen.getByText('Board deck')).toBeInTheDocument();
    expect(screen.getByText('Automate intake')).toBeInTheDocument();
  });

  it('clicking an Output item calls onOpenOutput with its id', async () => {
    hoisted.getSessionLineage.mockResolvedValue({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [{ id: 'out-1', outputVersion: 1, status: 'current' }],
      reports: [],
      presentations: [],
      initiativeDrafts: [],
    });
    const onOpenOutput = vi.fn();
    const user = userEvent.setup();

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={vi.fn()} onOpenOutput={onOpenOutput} />);

    await user.click(await screen.findByText('v1'));
    expect(onOpenOutput).toHaveBeenCalledWith('out-1');
  });

  it('shows an explanation for a group with no items yet, instead of hiding the section', async () => {
    hoisted.getSessionLineage.mockResolvedValue({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [],
      reports: [],
      presentations: [],
      initiativeDrafts: [],
    });

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={vi.fn()} />);

    expect(await screen.findByText('No frozen Output yet.')).toBeInTheDocument();
    expect(screen.getByText('No Report snapshot yet.')).toBeInTheDocument();
  });

  it('shows an error state with retry when the lineage fails to load', async () => {
    hoisted.getSessionLineage.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={vi.fn()} />);

    expect(await screen.findByText('Could not load lineage')).toBeInTheDocument();

    hoisted.getSessionLineage.mockResolvedValueOnce({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [],
      reports: [],
      presentations: [],
      initiativeDrafts: [],
    });
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Session sess-1')).toBeInTheDocument();
    });
  });

  it('shows a distinct "no access" state on a 401/403', async () => {
    hoisted.getSessionLineage.mockRejectedValueOnce(new MethodCoreApiError('Forbidden', 403, {}));

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={vi.fn()} />);

    expect(await screen.findByText('No access to lineage')).toBeInTheDocument();
  });

  it('shows an honest "could not read this" error for an unrecognized response shape, never fabricated structure', async () => {
    hoisted.getSessionLineage.mockResolvedValue({ somethingWeird: true });

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={vi.fn()} />);

    expect(await screen.findByText('Could not read this lineage')).toBeInTheDocument();
  });

  it('the Close button calls onClose', async () => {
    hoisted.getSessionLineage.mockResolvedValue({
      session: { id: 'sess-1', label: 'Session sess-1' },
      outputs: [],
      reports: [],
      presentations: [],
      initiativeDrafts: [],
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ArtifactLineagePanel sessionId="sess-1" onClose={onClose} />);
    await screen.findByText('Session sess-1');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
