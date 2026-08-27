/**
 * @vitest-environment jsdom
 *
 * NIGHT_SWEEP_A_REPORT_20260826.md #6 — ROI registry mixed raw-id/English
 * findings:
 *  - Owner column/preview rendered the raw `ownerUserId` id
 *    ("user-anna-kowals…") instead of the org member's real name.
 *  - "Next step" mixed English values ("Complete Economic Model") into an
 *    otherwise-Polish column.
 *
 * `humanizeActionType`'s known-value table is grep-verified against every
 * `next_action_type = '...'` assignment in
 * `server/src/services/resultsVnext/roi/` — the real server emits exactly
 * three values today, all post-investment-review side effects.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { humanizeActionType } from '../../../../src/components/ResultsVNext/roi/roiRegistryMappers';
import {
  buildRoiCaseColumns,
  buildRoiCaseRowMenu,
} from '../../../../src/components/ResultsVNext/roi/roiRegistryPresenters';
import type { RoiCaseListItem } from '../../../../src/components/ResultsVNext/roi/roiApi';

function makeRow(overrides: Partial<RoiCaseListItem> = {}): RoiCaseListItem {
  return {
    caseId: 'case-1',
    organizationId: 'org-1',
    initiativeId: 'ini-1',
    title: 'Automatyzacja magazynu',
    ownerUserId: 'user-anna-kowalska',
    status: 'tracking',
    currency: 'PLN',
    granularity: 'monthly',
    analysisStart: null,
    analysisEnd: null,
    nextActionType: null,
    nextActionDueAt: null,
    nextReviewAt: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as RoiCaseListItem;
}

describe('humanizeActionType — known ROI next_action_type values get real PL/EN sentences', () => {
  it('translates every value the real server actually emits', () => {
    expect(humanizeActionType('complete_economic_model', true)).toBe('Uzupełnij model ekonomiczny');
    expect(humanizeActionType('review_decision', true)).toBe('Podejmij decyzję');
    expect(humanizeActionType('start_tracking', true)).toBe('Rozpocznij śledzenie korzyści');
    expect(humanizeActionType('record_actual', true)).toBe('Zarejestruj wartość rzeczywistą');
    expect(humanizeActionType('set_baseline', true)).toBe('Ustal wartość bazową');
    expect(humanizeActionType('conduct_post_investment_review', true)).toBe(
      'Przeprowadź przegląd poinwestycyjny'
    );
    expect(humanizeActionType('finalize_post_investment_review', true)).toBe(
      'Sfinalizuj przegląd poinwestycyjny'
    );
    expect(humanizeActionType('post_investment_review', true)).toBe('Przegląd poinwestycyjny');
    expect(humanizeActionType('post_investment_review', false)).toBe('Post-investment review');
  });

  it('falls back to an honest humanized label for any value not in the known table (never a raw code)', () => {
    expect(humanizeActionType('some_future_action_type', true)).toBe(
      'Nieznana akcja: Some Future Action Type'
    );
  });
});

describe('ROI registry — Owner column resolves ownerUserId to a real name', () => {
  it('renders the resolved member name, not the raw id, when the resolver knows it', () => {
    const columns = buildRoiCaseColumns(false, (userId) =>
      userId === 'user-anna-kowalska' ? 'Anna Kowalska' : null
    );
    const ownerColumn = columns.find((c) => c.id === 'owner')!;
    render(<>{ownerColumn.render?.(makeRow())}</>);

    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
    expect(screen.queryByText('user-anna-kowalska')).not.toBeInTheDocument();
  });

  it('falls back to the raw id, honestly, when the resolver has no match (e.g. deactivated account)', () => {
    const columns = buildRoiCaseColumns(false, () => null);
    const ownerColumn = columns.find((c) => c.id === 'owner')!;
    render(<>{ownerColumn.render?.(makeRow())}</>);

    expect(screen.getByText('user-anna-kowalska')).toBeInTheDocument();
  });

  it('defaults to no-resolver (raw id) when no resolver argument is passed at all', () => {
    const columns = buildRoiCaseColumns(false);
    const ownerColumn = columns.find((c) => c.id === 'owner')!;
    render(<>{ownerColumn.render?.(makeRow())}</>);

    expect(screen.getByText('user-anna-kowalska')).toBeInTheDocument();
  });
});

describe('ROI registry — concise owner-approved row menu', () => {
  it('offers one canonical full-tool entry and preview without unavailable actions', () => {
    const menu = buildRoiCaseRowMenu(makeRow({ status: 'modeling' }), true, {
      onPreview: vi.fn(),
      onTransition: vi.fn(),
      onModel: vi.fn(),
    });

    expect(menu.primary?.map((action) => action.label)).toEqual(['Otwórz pełne narzędzie']);
    expect(menu.statusTransitions).toEqual([]);
    expect(menu.universalHandlers).toEqual({ preview: expect.any(Function) });
  });
});
