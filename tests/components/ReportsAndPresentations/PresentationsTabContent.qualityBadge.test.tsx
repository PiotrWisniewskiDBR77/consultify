/**
 * @vitest-environment jsdom
 *
 * P2.5 — quality/validation badge in the Prezentacje list column.
 *
 * Decks do not carry a per-deck bundleQualityScorecard (that scorecard is
 * business-plan-bundle only — see server/src/services/deliverables/
 * bundleQualityScorecard.ts, wired only into generateBundleFromSpine). What
 * every deck row DOES carry is `governance.validationState` from the artifact
 * registry. This test asserts the "quality" column renders a badge from that
 * real signal when present, and renders nothing (no fabricated grade) when
 * governance/validationState is absent.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PresentationsTabContent } from '../../../src/components/ReportsAndPresentations/PresentationsTabContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback || _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: any) => governance,
}));

// Real StandardTable rendering logic is irrelevant here; what matters is
// that each column's `render(row)` executes so we can assert on the actual
// cell content (including the new "quality" column). Keep everything else
// from the real module (useTableSelection, BulkActionBar, etc.) via
// importOriginal so the component's other hooks keep working.
vi.mock('../../../src/components/shared/ModuleHub', () => ({
  GridView: () => <div data-testid="grid-view" />,
}));

vi.mock('../../../src/components/standard', () => ({
    StandardTable: ({ data, columns }: any) => (
      <div data-testid="filterable-table">
        {data.map((row: any) => (
          <div key={row.id} data-testid={`row-${row.id}`}>
            {columns.map((col: any) => (
              <div key={col.id} data-testid={`cell-${row.id}-${col.id}`}>
                {col.render ? col.render(row) : (row as any)[col.id]}
              </div>
            ))}
          </div>
        ))}
      </div>
    ),
    StandardPreview: ({ children }: any) => <div>{children}</div>,
}));

const actions = {
  exportDeckPptx: vi.fn(),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

function makeDeck(overrides: Record<string, unknown>) {
  return {
    id: 'deck-1',
    artifactId: 'art-1',
    title: 'Deck One',
    sourceType: 'tool',
    owner: 'User 1',
    status: 'draft',
    presentationMode: 'briefing',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    slideCount: 10,
    ...overrides,
  };
}

function renderTab(presentations: any[]) {
  render(
    <PresentationsTabContent
      viewMode="table"
      searchQuery=""
      activeFilters={[]}
      onFilterChange={() => {}}
      presentations={presentations}
      loading={false}
      error={null}
      onRefresh={() => {}}
      actions={actions as any}
      initialArtifactId={null}
    />
  );
}

describe('PresentationsTabContent quality badge', () => {
  it('renders a "Validated" badge when governance.validationState is validated', () => {
    renderTab([makeDeck({ governance: { validationState: 'validated' } })]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toContain('Validated');
  });

  // P2.6 — deck quality scorecard (checkDeckQualityGates) surfaced on the row.
  it('renders the letter grade + score when governance.deckScorecard is present', () => {
    renderTab([
      makeDeck({
        governance: {
          deckScorecard: {
            score: 92,
            grade: 'A',
            result: 'PASS',
            p0: 0,
            p1: 0,
            p2: 0,
            canExport: true,
            topIssues: [],
          },
        },
      }),
    ]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toContain('A');
    expect(cell.textContent).toContain('92');
  });

  it('exposes score + top issues in the grade chip tooltip (hover/expand)', () => {
    renderTab([
      makeDeck({
        governance: {
          deckScorecard: {
            score: 55,
            grade: 'F',
            result: 'BLOCKED_P1',
            p0: 1,
            p1: 0,
            p2: 0,
            canExport: false,
            topIssues: ['Placeholder content on 2 slides', 'Low source traceability'],
          },
        },
      }),
    ]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toContain('F');
    const chip = cell.querySelector('[title]') as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.getAttribute('title')).toContain('55/100');
    expect(chip.getAttribute('title')).toContain('BLOCKED_P1');
    expect(chip.getAttribute('title')).toContain('Placeholder content on 2 slides');
  });

  it('prefers the deckScorecard grade over the validationState fallback', () => {
    renderTab([
      makeDeck({
        governance: {
          validationState: 'attention_required',
          deckScorecard: {
            score: 84,
            grade: 'B',
            result: 'PASS_WITH_P2',
            p0: 0,
            p1: 0,
            p2: 1,
            canExport: true,
            topIssues: [],
          },
        },
      }),
    ]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toContain('B');
    expect(cell.textContent).not.toContain('Attention');
  });

  it('falls back to the validationState badge when no deckScorecard is present', () => {
    renderTab([makeDeck({ governance: { validationState: 'validated' } })]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toContain('Validated');
  });

  it('renders an "Attention" badge when governance.validationState is attention_required', () => {
    renderTab([makeDeck({ governance: { validationState: 'attention_required' } })]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toContain('Attention');
  });

  it('renders nothing (no fabricated score) when governance is absent', () => {
    renderTab([makeDeck({ governance: undefined })]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toBe('');
  });

  it('renders nothing when governance has no validationState', () => {
    renderTab([makeDeck({ governance: {} })]);
    const cell = screen.getByTestId('cell-deck-1-quality');
    expect(cell.textContent).toBe('');
  });
});
