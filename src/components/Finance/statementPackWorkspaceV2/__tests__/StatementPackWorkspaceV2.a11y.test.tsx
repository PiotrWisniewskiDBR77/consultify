/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność) — dialog „Podaj powód" w `StatementPackWorkspaceV2.tsx`
 * (identyczny wzorzec co `BaselineWorkspace.a11y.test.tsx`, ta sama
 * naprawa: `useDialogA11y` z fallbackiem na trigger lifecycle, bo pozycja
 * menu, która otwiera dialog, odmontowuje się przed callbackiem).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

import {
  StatementPackWorkspaceV2,
  type StatementPackWorkspaceV2Fetchers,
} from '../StatementPackWorkspaceV2';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function fakeFetchers(): StatementPackWorkspaceV2Fetchers {
  return {
    listLines: vi.fn().mockResolvedValue([]),
    getLineage: vi
      .fn()
      .mockResolvedValue({ businessVersionId: 'bv-1', ancestors: [], descendants: [] }),
    listReconciliationRuns: vi.fn().mockResolvedValue([]),
    getReconciliationRunDetail: vi.fn(),
    generateReportDraft: vi.fn(),
    publishReport: vi.fn(),
    getIdentity: vi.fn().mockResolvedValue({
      artifactId: 'art-1',
      name: 'Sprawozdanie testowe',
      status: 'IN_REVIEW',
      freshness: 'CURRENT',
      versionNo: 1,
      version: 1,
    }),
    renameArtifact: vi.fn(),
    transitionVersion: vi.fn().mockResolvedValue({ status: 'NEEDS_CHANGES', version: 2 }),
    approveModel: vi.fn(),
    reopenModel: vi.fn(),
  };
}

const resolveLineLabel = (rowKey: string) => rowKey;

function renderWorkspace(fetchers: StatementPackWorkspaceV2Fetchers) {
  return render(
    <StatementPackWorkspaceV2
      businessVersionId="bv-1"
      resolveLineLabel={resolveLineLabel}
      fetchers={fetchers}
      onOpenArtifact={() => {}}
      onCreateNew={() => {}}
      onOpenReportResult={() => {}}
    />
  );
}

async function openReasonDialog(): Promise<void> {
  const lifecycleTrigger = await screen.findByTestId('finance-workspace-bar-lifecycle-trigger');
  fireEvent.click(lifecycleTrigger);
  const menuItem = await screen.findByRole('menuitem', { name: 'Poproś o zmiany' });
  fireEvent.click(menuItem);
  await screen.findByTestId('statement-pack-reason-dialog');
}

describe('StatementPackWorkspaceV2 — dialog „Podaj powód" (a11y, Pakiet I)', () => {
  afterEach(() => {
    clearFeatureFlagOverrides();
  });

  it('otwiera się z rolą alertdialog i fokusem na polu tekstowym', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    const fetchers = fakeFetchers();
    renderWorkspace(fetchers);
    await waitFor(() => expect(fetchers.getIdentity).toHaveBeenCalled());
    await openReasonDialog();
    expect(screen.getByTestId('statement-pack-reason-dialog')).toHaveAttribute(
      'role',
      'alertdialog'
    );
    await waitFor(() => expect(screen.getByTestId('statement-pack-reason-input')).toHaveFocus());
  });

  it('Escape zamyka dialog i przywraca fokus na trigger lifecycle', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    const fetchers = fakeFetchers();
    renderWorkspace(fetchers);
    await waitFor(() => expect(fetchers.getIdentity).toHaveBeenCalled());
    const lifecycleTrigger = screen.getByTestId('finance-workspace-bar-lifecycle-trigger');
    await openReasonDialog();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByTestId('statement-pack-reason-dialog')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(lifecycleTrigger).toHaveFocus());
  });

  it('drugi Escape (dialog już zamknięty) jest no-opem — stan `pendingReasonFor` faktycznie wrócił do null', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    const fetchers = fakeFetchers();
    renderWorkspace(fetchers);
    await waitFor(() => expect(fetchers.getIdentity).toHaveBeenCalled());
    await openReasonDialog();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByTestId('statement-pack-reason-dialog')).not.toBeInTheDocument()
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('statement-pack-reason-dialog')).not.toBeInTheDocument();
  });
});
