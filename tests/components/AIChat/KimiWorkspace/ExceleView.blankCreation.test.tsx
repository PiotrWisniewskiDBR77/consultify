/**
 * ExceleView — "?entry=blank" auto-create gate regression tests.
 *
 * Bug fixed 2026-07-28 (żywy odbiór): `entryMode==='blank'` never left
 * 'blank' on its own:
 *   - on SUCCESS, `handleCreateEmptyGrid` navigates to
 *     `/excele?artifactId=<id>` — the SAME route (no remount, no `key` on
 *     `<ExceleView />` in AppRoutes.tsx) — so the render kept taking the
 *     `entryMode === 'blank'` early return forever, hiding the workbook that
 *     had already been created and loaded in the background.
 *   - on FAILURE, the `catch` block only fired a `toast.error(...)` (gone in
 *     a few seconds) with no permanent affordance — the spinner just stayed.
 *
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  pipelineState: null as any,
  apiPostMock: vi.fn(),
  apiGetMock: vi.fn(),
}));

// tests/setup.ts globally stubs `useNavigate` to a no-op `vi.fn()` (safety
// net for components rendered without a Router). This regression test's
// whole point is verifying a REAL same-route `navigate()` call (no remount)
// correctly clears the stuck spinner, so it needs the real implementation —
// per the setup file's own guidance, override it per-file.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual };
});

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => mockState.pipelineState,
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: (props: any) => (
    <div data-testid="kimi-shell" data-lane={props.lane}>
      <div data-testid="shell-preview-title">{props.preview?.title || 'none'}</div>
    </div>
  ),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio', () => ({
  SpreadsheetArtifactStudio: (props: any) => (
    <div data-testid="spreadsheet-artifact-studio" data-workbook-id={props.workbookId}>
      {props.preview?.title || 'none'}
    </div>
  ),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/ExceleRightPanel', () => ({
  ExceleRightPanel: () => <div data-testid="excele-right-panel" />,
}));

vi.mock('../../../../src/services/api', () => ({
  Api: {
    post: (...args: any[]) => mockState.apiPostMock(...args),
    get: (...args: any[]) => mockState.apiGetMock(...args),
  },
}));

vi.mock('../../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) =>
    selector({
      activeMessages: [],
    }),
}));

vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      chatKickoffMessage: null,
      clearChatKickoffMessage: vi.fn(),
    }),
}));

import ExceleView from '../../../../src/components/AIChat/KimiWorkspace/ExceleView';

function resetPipeline(overrides: Record<string, unknown> = {}) {
  mockState.pipelineState = {
    taskSteps: [],
    totalSteps: 8,
    completedSteps: 0,
    isGenerating: false,
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    preview: null,
    currentRun: null,
    isBusy: false,
    startGeneration: vi.fn().mockResolvedValue(undefined),
    advancePipeline: vi.fn().mockResolvedValue(undefined),
    handleReplay: vi.fn(),
    handleRemix: vi.fn(),
    handleDownload: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderExcele(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/excele" element={<ExceleView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ExceleView — ?entry=blank auto-create gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetPipeline();
  });

  it('does not hang on the spinner forever after the workbook is created (same-route navigate)', async () => {
    mockState.apiPostMock.mockResolvedValue({ data: { id: 'wb-1' } });
    mockState.apiGetMock.mockResolvedValue({
      title: 'Pusty arkusz',
      schema_json: { sheets: [{ name: 'Sheet1', cells: {} }] },
    });

    renderExcele('/excele?view=new&entry=blank');

    // Immediately shows the "creating" spinner.
    expect(screen.getByTestId('excele-blank-creating')).toBeInTheDocument();
    expect(screen.getByText('Tworzenie pustego arkusza…')).toBeInTheDocument();

    // POST /workbook/blank fires.
    await waitFor(() => {
      expect(mockState.apiPostMock).toHaveBeenCalledWith('/workbook/blank', {
        title: 'Pusty arkusz',
      });
    });

    // Regression guard: once the URL carries the real artifactId, the
    // spinner MUST go away — before the fix it stayed forever because
    // `entryMode` was never reset off 'blank'.
    await waitFor(() => {
      expect(screen.queryByTestId('excele-blank-creating')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Tworzenie pustego arkusza…')).not.toBeInTheDocument();

    // The real workbook shell renders instead.
    await waitFor(() => {
      expect(screen.getByTestId('kimi-shell')).toBeInTheDocument();
    });
  });

  it('switches the same loaded workbook to Artifact Studio only when both rollout flags are enabled', async () => {
    window.localStorage.setItem('ff.artifact_studio', 'true');
    window.localStorage.setItem('ff.spreadsheet_studio_v2', 'true');
    mockState.apiPostMock.mockResolvedValue({ data: { id: 'wb-v2' } });
    mockState.apiGetMock.mockResolvedValue({
      title: 'Skoroszyt V2',
      schema_json: { sheets: [{ name: 'KPI', cells: {} }] },
    });

    renderExcele('/excele?view=new&entry=blank');

    await waitFor(() => {
      expect(screen.getByTestId('spreadsheet-artifact-studio')).toHaveAttribute(
        'data-workbook-id',
        'wb-v2'
      );
    });
    expect(screen.queryByTestId('kimi-shell')).not.toBeInTheDocument();
  });

  it('keeps the legacy shell as an immediate rollback when the spreadsheet lane flag is off', async () => {
    window.localStorage.setItem('ff.artifact_studio', 'true');
    window.localStorage.setItem('ff.spreadsheet_studio_v2', 'false');
    mockState.apiPostMock.mockResolvedValue({ data: { id: 'wb-legacy' } });
    mockState.apiGetMock.mockResolvedValue({
      title: 'Skoroszyt legacy',
      schema_json: { sheets: [{ name: 'Sheet1', cells: {} }] },
    });

    renderExcele('/excele?view=new&entry=blank');

    await waitFor(() => {
      expect(screen.getByTestId('kimi-shell')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('spreadsheet-artifact-studio')).not.toBeInTheDocument();
  });

  it('shows a permanent retry/back state instead of an eternal spinner when creation fails', async () => {
    mockState.apiPostMock.mockRejectedValue(new Error('network down'));

    renderExcele('/excele?view=new&entry=blank');

    expect(screen.getByTestId('excele-blank-creating')).toBeInTheDocument();

    // Regression guard: after the failed POST, a PERMANENT failure state
    // (not a toast that disappears) must replace the spinner.
    await waitFor(() => {
      expect(screen.getByTestId('excele-blank-failed')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('excele-blank-creating')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Nie udało się utworzyć pustego arkusza. Spróbuj ponownie albo wróć do Materiałów.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wróć do Materiałów' })).toBeInTheDocument();

    // The failed state persists — it does not silently revert to "creating"
    // or disappear on its own once the toast would have faded.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId('excele-blank-failed')).toBeInTheDocument();
  });

  it('retries the creation when the user clicks "Spróbuj ponownie"', async () => {
    mockState.apiPostMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: { id: 'wb-2' } });
    mockState.apiGetMock.mockResolvedValue({
      title: 'Pusty arkusz',
      schema_json: { sheets: [] },
    });

    renderExcele('/excele?view=new&entry=blank');

    await waitFor(() => {
      expect(screen.getByTestId('excele-blank-failed')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    await waitFor(() => {
      expect(mockState.apiPostMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('excele-blank-failed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('excele-blank-creating')).not.toBeInTheDocument();
    });
  });
});
