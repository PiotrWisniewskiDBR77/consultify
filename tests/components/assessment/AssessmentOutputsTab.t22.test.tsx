/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, navigateMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
  navigateMock: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en' },
  }),
}));

// eslint-disable-next-line import/first -- must follow the vi.mock calls above
import { AssessmentOutputsTab } from '../../../src/components/assessment/AssessmentOutputsTab';

const ASSESSMENT_ROW = {
  artifactId: 'art-1',
  resolvedTitle: 'DRD readiness output',
  outputType: 'report',
  artifactFamily: 'document',
  deliveryState: 'draft',
  visibilityScope: 'organization',
  isDraft: true,
  ownerName: 'Jane Doe',
  createdBy: 'user-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  lastTransitionAt: '2026-07-20T00:00:00.000Z',
  originRuntime: 'assessment_report',
  originRecordId: 'asmt-1',
  openPath: '/assessment?assessmentId=asmt-1',
  exportPath: null,
  deletePath: null,
  authority: 'assessment_workbench',
};

const OTHER_ROW = {
  artifactId: 'art-2',
  resolvedTitle: 'Some deck',
  outputType: 'presentation',
  artifactFamily: 'presentation',
  deliveryState: 'draft',
  visibilityScope: 'organization',
  isDraft: false,
  ownerName: 'John Roe',
  createdBy: 'user-2',
  createdAt: '2026-07-01T00:00:00.000Z',
  lastTransitionAt: '2026-07-21T00:00:00.000Z',
  originRuntime: 'presentation',
  originRecordId: 'deck-1',
  openPath: '/presentations/builder/deck-1',
  exportPath: '/api/presentations/decks/deck-1/download',
  deletePath: '/api/presentations/decks/deck-1',
  authority: 'presentations_runtime',
};

function mockArtifactsResponse(rows: unknown[]) {
  apiMock.get.mockResolvedValueOnce({
    data: { data: rows, total: rows.length, canonicalHome: 'outputs_library' },
  });
}

describe('T22-TABLE-PREVIEW-COMPONENT AssessmentOutputsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches /api/artifacts and filters strictly to originRuntime === assessment_report', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW, OTHER_ROW]);
    render(<AssessmentOutputsTab />);

    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());
    expect(screen.queryByText('Some deck')).not.toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(String(apiMock.get.mock.calls[0][0])).toContain('/artifacts');
  });

  it('reports the truthful filtered row count to its parent, including empty and error states', async () => {
    const onCountChange = vi.fn();
    mockArtifactsResponse([ASSESSMENT_ROW, OTHER_ROW]);
    const { unmount } = render(<AssessmentOutputsTab onCountChange={onCountChange} />);

    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(1));
    unmount();

    vi.clearAllMocks();
    apiMock.get.mockRejectedValueOnce(new Error('network down'));
    render(<AssessmentOutputsTab onCountChange={onCountChange} />);
    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(null));
  });

  it('renders a populated table with real, non-fabricated fields', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());
    expect(screen.getByText('report')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('honest empty state preserves table surface/geometry (header still renders, zero rows)', async () => {
    mockArtifactsResponse([]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('No outputs yet')).toBeInTheDocument());
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('honest error state on fetch failure — distinct from empty, no silent fallback', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('network down'));
    render(<AssessmentOutputsTab />);
    // QA-CORRECTION-2: the UI must show the fixed generic message, never the
    // raw exception text (see the dedicated leak test below for the
    // credential/URL-shaped case).
    await waitFor(() =>
      expect(screen.getByText('Failed to load outputs. Please try again.')).toBeInTheDocument()
    );
    expect(screen.queryByText('network down')).not.toBeInTheDocument();
    expect(screen.queryByText('No outputs yet')).not.toBeInTheDocument();
  });

  it('QA-CORRECTION-2: never renders raw exception text (URLs/SQL/credential-shaped), only the generic error string', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.get.mockRejectedValueOnce(
      new Error(
        'request to https://internal-db.example.com/sql?query=SELECT%20*%20FROM%20users failed: Authorization: Bearer eyJSECRET_MARKER'
      )
    );
    render(<AssessmentOutputsTab />);
    await waitFor(() =>
      expect(screen.getByText('Failed to load outputs. Please try again.')).toBeInTheDocument()
    );
    expect(document.body.textContent).not.toContain('eyJSECRET_MARKER');
    expect(document.body.textContent).not.toContain('internal-db.example.com');
    expect(document.body.textContent).not.toMatch(/Bearer|apiKey|SELECT/i);
    expect(consoleError).toHaveBeenCalledWith(
      '[AssessmentOutputsTab] failed to load outputs registry'
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
      /eyJSECRET_MARKER|internal-db\.example\.com|Bearer|apiKey|SELECT/i
    );
    consoleError.mockRestore();
  });

  it('QA-CORRECTION-1: a sparse registry row never fabricates title/type/state/visibility as persisted facts', async () => {
    mockArtifactsResponse([
      {
        artifactId: 'art-sparse',
        originRuntime: 'assessment_report',
        // One genuine fact present (so the builder doesn't hit its
        // all-facts-absent early return — same requirement T21/T23/T24's own
        // sparse-row tests already follow) — title/type/state/visibility
        // stay genuinely absent from the source row, which is what this
        // test is actually about.
        ownerName: 'Real Owner',
      },
    ]);
    render(<AssessmentOutputsTab />);
    // Table cell shows a visual-only placeholder — this is the ONE place a
    // stand-in label is allowed, and it must not appear in the persisted
    // Details prose below as though it were a stored fact.
    await waitFor(() => expect(screen.getByText('Untitled output')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Untitled output'));

    const details = await screen.findByText(/nie został(?:a|o)? zapisan|was not persisted/);
    const detailsText = details.textContent || '';
    expect(detailsText).toContain('The output title was not persisted in the selected record.');
    expect(detailsText).toContain('The output type was not persisted in the selected record.');
    expect(detailsText).toContain(
      'The output visibility was not persisted in the selected record.'
    );
    expect(detailsText).toContain('The output status was not persisted in the selected record.');
    // None of the old fabricated defaults leak into the prose.
    expect(detailsText).not.toContain('Untitled output.');
    expect(detailsText).not.toContain('Type: report.');
    expect(detailsText).not.toContain('Status: draft.');
    expect(detailsText).not.toContain('Visibility: organization.');
    // The one genuine fact on the row still renders normally.
    expect(detailsText).toContain('Owner: Real Owner.');

    // Preview meta: no fabricated type/status pill for the missing values
    // (QA-CORRECTION-1's "omit rather than treat missing as successful") —
    // neither placeholder word appears anywhere in the whole render: not in
    // a table cell (those show '—'), not in Details prose (asserted above),
    // and not in a meta pill.
    expect(screen.queryByText('report')).not.toBeInTheDocument();
    expect(screen.queryByText('draft')).not.toBeInTheDocument();
  });

  it('row click opens the canonical StandardPreview with factual, whitelisted Details prose (<=140 words)', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());
    fireEvent.click(screen.getByText('DRD readiness output'));

    const details = await screen.findByText(/^Output: DRD readiness output\./);
    const detailsText = details.textContent || '';
    expect(detailsText).toContain('Type: report.');
    expect(detailsText).toContain('Owner: Jane Doe.');
    expect(detailsText.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
  });

  it('never leaks fields outside the whitelist into Details prose, even if present on the row', async () => {
    mockArtifactsResponse([
      {
        ...ASSESSMENT_ROW,
        // The server never actually returns these for a list row, but this
        // proves the builder can't be tricked into echoing them if it did.
        apiKey: 'MUST_NOT_LEAK',
        authorization: 'Bearer MUST_NOT_LEAK_TOKEN',
      },
    ]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());
    fireEvent.click(screen.getByText('DRD readiness output'));
    await screen.findByText(/^Output: DRD readiness output\./);
    expect(document.body.textContent).not.toContain('MUST_NOT_LEAK');
  });

  it('T22-KEBAB-K01/T22-PPM-C01: has no selection checkboxes or Menu3 bulk row (kebab is now real, see below)', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    const { container } = render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());

    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(container.querySelector('[data-menu3-bulk]')).toBeNull();
  });

  it('T22-KEBAB-K01: kebab is visible and exposes exactly the truthful actions — no invented Export/Delete/Duplicate/Edit/Archive/Rename', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());

    const kebabButtons = screen.getAllByLabelText('Row actions');
    expect(kebabButtons).toHaveLength(1);
    fireEvent.click(kebabButtons[0]);

    expect(await screen.findByRole('menuitem', { name: 'Open full' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open preview' })).toBeInTheDocument();
    // Exactly these two — nothing else, real or disabled.
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.queryByRole('menuitem', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /duplicate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /archive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument();
  });

  it('T22-KEBAB-K01: "Open full" navigates to the exact registry-provided openPath', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());

    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open full' }));

    expect(navigateMock).toHaveBeenCalledWith('/assessment?assessmentId=asmt-1');
  });

  it('T22-KEBAB-K01: "Open preview" opens the same docked StandardPreview row click does', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());
    expect(screen.queryByText(/^Output: DRD readiness output\./)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open preview' }));

    expect(await screen.findByText(/^Output: DRD readiness output\./)).toBeInTheDocument();
  });

  it('T22-PPM-C01: right-click opens the identical action set as the kebab — no separate implementation', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    const row = await screen.findByText('DRD readiness output');

    fireEvent.contextMenu(row);

    expect(await screen.findByRole('menuitem', { name: 'Open full' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open preview' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('T22-KEBAB-K01: a row with no registry-provided openPath omits "Open full" but keeps "Open preview"', async () => {
    mockArtifactsResponse([{ ...ASSESSMENT_ROW, openPath: null }]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());

    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);

    expect(await screen.findByRole('menuitem', { name: 'Open preview' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Open full' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('preserves the registry-provided openPath and never invents export/delete routes', async () => {
    mockArtifactsResponse([ASSESSMENT_ROW]);
    render(<AssessmentOutputsTab />);
    await waitFor(() => expect(screen.getByText('DRD readiness output')).toBeInTheDocument());
    fireEvent.click(screen.getByText('DRD readiness output'));
    await screen.findByText(/^Output: DRD readiness output\./);

    const openButton = await screen.findByRole('button', { name: /open/i });
    fireEvent.click(openButton);
    expect(navigateMock).toHaveBeenCalledWith('/assessment?assessmentId=asmt-1');
    // No export/delete affordance is rendered for a row whose registry-provided
    // exportPath/deletePath are both null — nothing was invented client-side.
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});

/*
 * ── Negative controls (run manually against the real files, not committed as
 *    additional in-suite assertions — same convention as
 *    tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx and
 *    server/src/services/assessment/__tests__/assessmentWorkbench.t22-data-prereq.test.ts):
 *
 *   1. Removed the `if (record.originRuntime !== ASSESSMENT_REPORT_ORIGIN_RUNTIME)
 *      continue;` filter in assessmentOutputs.ts → the "filters strictly to
 *      originRuntime === assessment_report" test failed (OTHER_ROW's "Some
 *      deck" appeared, `queryByText` assertion flipped to found).
 *   2. Removed the `onRowClick={(row) => setSelectedId(String(row.id))}` prop
 *      from the StandardTable in AssessmentOutputsTab.tsx → the "row click
 *      opens the canonical StandardPreview" test failed (`findByText` on the
 *      Details prose timed out, preview never opened).
 *   Both restored identically (diff against pre-edit copies was empty) and
 *   the full suite re-verified green before this report.
 */
