/**
 * Render proof — HP-8 status bar, all 5 wired artifact types.
 *
 * HP-8 base (2026-07-15) built `ArtifactApprovalStatusBar` +
 * `useArtifactApprovalStatus` for Decision/Insight. Commit 9e30ba1578
 * (2026-07-18, on origin/demo) wires 3 more consumers — Initiative, Report,
 * Deck — via 1:1 reuse of the SAME component (see DecisionDetailView.tsx,
 * InsightViewer.tsx, InitiativeDocumentView.tsx, ReportEditor.tsx,
 * DeckBuilder.tsx/DeckBuilderTopBar.tsx). The state machine itself is
 * proven end-to-end against real Postgres by
 * tests/acceptance/hp8-artifact-approvals.e2e.test.ts (4/4 passing for
 * initiative/report/deck). This test is the FE render-proof companion: it
 * mounts the shared component directly for each of the 5 types and checks
 * the state pill renders the right label — the piece the acceptance test
 * (which only hits the REST layer) doesn't cover.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'sharedComponents.artifactApprovalStatusBar.stateDraft': 'Draft',
        'sharedComponents.artifactApprovalStatusBar.stateReview': 'In review',
        'sharedComponents.artifactApprovalStatusBar.stateApproved': 'Approved',
        'sharedComponents.artifactApprovalStatusBar.stateRejected': 'Rejected',
        'sharedComponents.artifactApprovalStatusBar.submitForReview': 'Submit for review',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

import { ArtifactApprovalStatusBar } from '../../src/components/standard/ArtifactApprovalStatusBar';
import type { ArtifactApprovalState } from '../../src/services/api/artifactApprovals.api';

const mockGetState = vi.fn();

vi.mock('../../src/services/api/artifactApprovals.api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/services/api/artifactApprovals.api')>();
  return {
    ...actual,
    getArtifactApprovalState: (...args: unknown[]) => mockGetState(...args),
  };
});

const ARTIFACT_TYPES = ['decision', 'insight', 'initiative', 'report', 'deck'] as const;

const STATE_LABEL: Record<ArtifactApprovalState, string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};

afterEach(() => {
  mockGetState.mockReset();
});

describe('ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill', () => {
  it.each(ARTIFACT_TYPES)(
    'renders the "approved" pill for artifactType=%s',
    async (artifactType) => {
      mockGetState.mockResolvedValue({
        state: 'approved' satisfies ArtifactApprovalState,
        assignment: {
          id: 'test-assignment',
          status: 'DONE',
          assigned_to_user_id: 'user-1',
          sla_due_at: new Date().toISOString(),
          artifact_type: artifactType,
          artifact_id: `test-${artifactType}-1`,
        },
      });

      render(
        <ArtifactApprovalStatusBar
          artifactType={artifactType}
          artifactId={`test-${artifactType}-1`}
          currentUserId="user-1"
        />
      );

      expect(await screen.findByText(STATE_LABEL.approved)).toBeInTheDocument();
      expect(mockGetState).toHaveBeenCalledWith(artifactType, `test-${artifactType}-1`);
    }
  );

  it.each(ARTIFACT_TYPES)(
    'does not fabricate a draft pill and exposes Submit for artifactType=%s without a record',
    async (artifactType) => {
      mockGetState.mockResolvedValue({
        state: 'draft' satisfies ArtifactApprovalState,
        assignment: null,
      });

      render(
        <ArtifactApprovalStatusBar
          artifactType={artifactType}
          artifactId={`test-${artifactType}-2`}
          currentUserId="user-1"
        />
      );

      expect(await screen.findByText('Submit for review')).toBeInTheDocument();
      expect(screen.queryByText(STATE_LABEL.draft)).not.toBeInTheDocument();
    }
  );
});
