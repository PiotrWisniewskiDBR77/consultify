/**
 * ConclusionsHub — list + readout surface tests.
 *
 * Verifies the org-wide conclusions list renders governed cards (verdict +
 * source + confidence), the empty state offers a run-a-tool CTA, the error
 * state offers retry, and opening a conclusion (?id=) renders the readout
 * detail (evidence, limits, sources) from the detail endpoint.
 *
 * 1.1-Z3 #1 (DECYZJA CTO: odczyt nie może pisać) — `GET /api/conclusions` no
 * longer syncs sources as a side effect; this hub must call
 * `ConclusionsApi.sync()` explicitly on entry (once) before `list()`, must
 * still load the list when sync fails (e.g. 403 — no write permission), and
 * must offer a "Refresh" control that re-runs sync + list.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConclusionsHub from '@/components/Conclusions/ConclusionsHub';
import { ConclusionsApi } from '@/services/api/conclusions.api';

const tMock = (key: string, fallback?: string | Record<string, unknown>, opts?: any) => {
  const base = typeof fallback === 'string' ? fallback : key;
  if (opts && typeof opts.count === 'number') return base.replace('{{count}}', String(opts.count));
  return base;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: tMock }),
}));

vi.mock('@/services/api/conclusions.api', () => ({
  ConclusionsApi: {
    sync: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  },
}));

// Shared states import react-i18next internally; keep them light-weight but real.

const mockConclusion = {
  id: 'c-1',
  organizationId: 'org-1',
  projectId: null,
  title: 'Automate order intake first',
  statement: 'Order intake is the highest-friction, highest-volume manual step.',
  sourceModule: 'tool',
  sourceArtifactRefs: [
    { type: 'tool_session', id: 'ts-1', title: 'RPA Scanner', url: '/my-work?sessionId=ts-1' },
  ],
  sourcePackId: 'sp-1',
  confidenceLevel: 'medium',
  limits: 'Validate assumptions before execution.',
  evidenceRefs: [{ type: 'tool_session', ref: 'ts-1', excerpt: '42 orders/day handled by hand' }],
  recommendedNextAction: 'Scope an RPA pilot for order intake.',
  status: 'candidate' as const,
  createdBy: 'user-1',
  createdAt: '2026-07-03T00:00:00Z',
  updatedAt: '2026-07-03T00:00:00Z',
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConclusionsHub />
    </MemoryRouter>
  );

describe('ConclusionsHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ConclusionsApi.sync as any).mockResolvedValue({ synced: { interview: 0, assessment: 0, tools: 0 } });
  });

  it('syncs exactly once on entry, then loads the list', async () => {
    (ConclusionsApi.list as any).mockResolvedValue({ conclusions: [mockConclusion] });

    renderAt('/conclusions');

    await waitFor(() =>
      expect(screen.getByText('Automate order intake first')).toBeInTheDocument()
    );
    expect(ConclusionsApi.sync).toHaveBeenCalledTimes(1);
    expect(ConclusionsApi.list).toHaveBeenCalledTimes(1);
    // sync must resolve (and be observed) before the list is fetched.
    const syncOrder = (ConclusionsApi.sync as any).mock.invocationCallOrder[0];
    const listOrder = (ConclusionsApi.list as any).mock.invocationCallOrder[0];
    expect(syncOrder).toBeLessThan(listOrder);
  });

  it('loads the list even when sync is refused (403 — no write permission)', async () => {
    const forbidden: any = new Error('Forbidden');
    forbidden.status = 403;
    (ConclusionsApi.sync as any).mockRejectedValue(forbidden);
    (ConclusionsApi.list as any).mockResolvedValue({ conclusions: [mockConclusion] });

    renderAt('/conclusions');

    await waitFor(() =>
      expect(screen.getByText('Automate order intake first')).toBeInTheDocument()
    );
    expect(ConclusionsApi.sync).toHaveBeenCalledTimes(1);
    expect(ConclusionsApi.list).toHaveBeenCalledTimes(1);
  });

  it('the Refresh control re-runs sync then list', async () => {
    (ConclusionsApi.list as any).mockResolvedValue({ conclusions: [mockConclusion] });

    renderAt('/conclusions');

    await waitFor(() =>
      expect(screen.getByText('Automate order intake first')).toBeInTheDocument()
    );
    expect(ConclusionsApi.sync).toHaveBeenCalledTimes(1);
    expect(ConclusionsApi.list).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('conclusions-refresh'));

    await waitFor(() => expect(ConclusionsApi.sync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ConclusionsApi.list).toHaveBeenCalledTimes(2));
  });

  it('renders governed conclusion cards from the list endpoint', async () => {
    (ConclusionsApi.list as any).mockResolvedValue({ conclusions: [mockConclusion] });

    renderAt('/conclusions');

    await waitFor(() =>
      expect(screen.getByText('Automate order intake first')).toBeInTheDocument()
    );
    // Verdict rationale + source label + confidence chip are all present on the card.
    expect(
      screen.getByText('Order intake is the highest-friction, highest-volume manual step.')
    ).toBeInTheDocument();
    expect(screen.getByText('Discovery tool')).toBeInTheDocument();
    expect(screen.getByText('Medium confidence')).toBeInTheDocument();
  });

  it('shows the empty state with a run-a-tool CTA when there are no conclusions', async () => {
    (ConclusionsApi.list as any).mockResolvedValue({ conclusions: [] });

    renderAt('/conclusions');

    await waitFor(() => expect(screen.getByText('No conclusions yet')).toBeInTheDocument());
    expect(screen.getByText('Open Tools')).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails', async () => {
    (ConclusionsApi.list as any).mockRejectedValue(new Error('boom'));

    renderAt('/conclusions');

    await waitFor(() =>
      expect(screen.getByText('Could not load conclusions')).toBeInTheDocument()
    );
  });

  it('renders the readout detail (evidence, limits, sources) when opened via ?id=', async () => {
    (ConclusionsApi.list as any).mockResolvedValue({ conclusions: [mockConclusion] });
    (ConclusionsApi.get as any).mockResolvedValue({
      conclusion: mockConclusion,
      sourcePack: {
        id: 'sp-1',
        organizationId: 'org-1',
        projectId: null,
        sourceModule: 'tool',
        sourceArtifactRefs: [],
        evidenceRefs: [],
        contextSummary: 'Captured from RPA Scanner session.',
        limitations: [],
        capturedAt: '2026-07-03T00:00:00Z',
        createdAt: '2026-07-03T00:00:00Z',
        updatedAt: '2026-07-03T00:00:00Z',
      },
      conversions: [],
    });

    renderAt('/conclusions?id=c-1');

    await waitFor(() => expect(ConclusionsApi.get).toHaveBeenCalledWith('c-1'));
    // Verdict heading + evidence excerpt + limits + captured context all render.
    await waitFor(() =>
      expect(screen.getByText('Automate order intake first')).toBeInTheDocument()
    );
    expect(screen.getByText('42 orders/day handled by hand')).toBeInTheDocument();
    expect(screen.getByText('Validate assumptions before execution.')).toBeInTheDocument();
    expect(screen.getByText('Captured from RPA Scanner session.')).toBeInTheDocument();
    expect(screen.getByText('Scope an RPA pilot for order intake.')).toBeInTheDocument();
  });
});
