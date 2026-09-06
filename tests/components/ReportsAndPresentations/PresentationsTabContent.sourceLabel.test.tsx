/**
 * @vitest-environment jsdom
 *
 * P1/P4 odbiór na żywo 06.09 (evidence/odbior-zywo-20260906/P1/materialy-1280.png):
 * panel podglądu Materiałów pokazywał w polu "Źródło" surowy techniczny
 * identyfikator rekordu źródłowego (`05189ab2766442c9b2c9116352a8fb5a`) zamiast
 * jego nazwy. `PreviewRelations`'owy `containsTechnicalIdentifier` guard
 * (src/components/shared/PreviewPane/businessDisplayLabel.ts) NIE łapie tego
 * konkretnego kształtu — 32-znakowy hex BEZ myślników nie pasuje do
 * `UUID_PATTERN` (wymaga myślników 8-4-4-4-12) ani do prefix/suffix
 * heurystyk — więc surowy ID przechodził przez ten bezpiecznik bez zmian.
 *
 * Fix (PresentationsTabContent.tsx, `resolvePreviewSourceName`): rozwiązuje
 * `sourceId` na `artifact_name` z `sourceRefs` (ten sam wzorzec resolvera
 * id→nazwa co P4 `useResultsEntityNames`/`useOrganizationMemberNames`),
 * "—" gdy brak dopasowania — nigdy surowy ID.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { PresentationsTabContent } from '../../../src/components/ReportsAndPresentations/PresentationsTabContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback || _k,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: unknown) => governance,
}));

const actions = {
  exportDeckPptx: vi.fn(),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

const RAW_SOURCE_ID = '05189ab2766442c9b2c9116352a8fb5a';

function makeDeck(overrides: Record<string, unknown>) {
  return {
    id: 'deck-1',
    artifactId: 'art-1',
    title: 'Deck One',
    sourceType: 'assessment',
    owner: 'User 1',
    status: 'draft',
    presentationMode: 'briefing',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    slideCount: 10,
    governance: {},
    ...overrides,
  };
}

function renderTab(presentations: unknown[]) {
  render(
    <MemoryRouter initialEntries={['/materials']}>
      <PresentationsTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        presentations={presentations as never}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as never}
        initialArtifactId="deck-1"
      />
    </MemoryRouter>
  );
}

describe('PresentationsTabContent — pole "Źródło" w podglądzie', () => {
  it('pokazuje nazwę z sourceRefs zamiast surowego ID', () => {
    renderTab([
      makeDeck({
        sourceId: RAW_SOURCE_ID,
        sourceRefs: [
          { artifact_id: RAW_SOURCE_ID, artifact_type: 'assessment', artifact_name: 'Ocena Q3 2026' },
        ],
      }),
    ]);

    expect(screen.getByText(/Źródło: Ocena Q3 2026/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(RAW_SOURCE_ID))).not.toBeInTheDocument();
  });

  it('pokazuje "—" (nigdy surowy ID) gdy sourceRefs nie ma dopasowania', () => {
    renderTab([
      makeDeck({
        sourceId: RAW_SOURCE_ID,
        sourceRefs: [],
      }),
    ]);

    expect(screen.getByText(/Źródło: —/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(RAW_SOURCE_ID))).not.toBeInTheDocument();
  });

  it('nie pokazuje pigułki Źródło, gdy sourceId jest pusty', () => {
    renderTab([makeDeck({ sourceId: undefined, sourceRefs: [] })]);

    expect(screen.queryByText(/Źródło:/)).not.toBeInTheDocument();
  });
});
