/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the "mindmap-i18n-smoke" defect (dyżur 05.09):
 * odbiór na żywo zgłosił, że sekcja "Dowody i źródła" w panelu właściwości
 * węzła mapy myśli nie reagowała na kliknięcia w automacie — została zwinięta
 * i nigdy nie otworzyła modal "Dodaj dowód / źródło".
 *
 * UnifiedNodeDetailDrawer (mindmapDrawerUnified, default ON since 2026-07-16)
 * had ZERO dedicated tests before this file. The repro path is: Moja Praca →
 * Pomysły → [otwórz pomysł] → mapa myśli (IdeaRecommendationMap, variant=
 * "mindmap") → element → sekcja "Dowody i źródła" → "Dodaj dowód".
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : String(fallback ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaAISuggestions: vi.fn(async () => ({ suggestions: [] })),
    getObjectArtifacts: vi.fn(async () => ({ artifactLinks: [] })),
  },
  getMapVersionFromPayload: vi.fn(() => 1),
}));

vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: vi.fn(async () => ({})),
}));

vi.mock('@/actions/ideaActionRegistry', () => ({
  runIdeaAction: vi.fn(async () => ({})),
}));

import { UnifiedNodeDetailDrawer, type UnifiedNodeData } from '../UnifiedNodeDetailDrawer';

const baseNodeData: UnifiedNodeData = {
  nodeId: 'node-1',
  label: 'Automate invoice matching',
  status: 'idea',
  evidenceLinks: [],
};

describe('UnifiedNodeDetailDrawer (variant="mindmap") — Evidence & Sources section', () => {
  it('expands the "Evidence & Sources" toggle on click and reveals "Add evidence"', async () => {
    render(
      <UnifiedNodeDetailDrawer
        variant="mindmap"
        open
        onClose={vi.fn()}
        nodeData={baseNodeData}
        ideaId="idea-1"
        ideaTitle="Ops efficiency"
        allNodes={[{ id: 'node-1', data: baseNodeData }]}
        allEdges={[]}
        onUpdateNode={vi.fn()}
      />
    );

    const drawer = await screen.findByTestId('unified-node-detail-drawer');
    const toggle = within(drawer).getByRole('button', { name: /Evidence & Sources/i });

    // Zero evidence links → defaultOpen is false; the section starts collapsed.
    expect(within(drawer).queryByRole('button', { name: /^Add evidence$/i })).toBeNull();

    fireEvent.click(toggle);

    const addEvidenceButton = await within(drawer).findByRole('button', {
      name: /^Add evidence$/i,
    });
    expect(addEvidenceButton).toBeInTheDocument();
  });

  it('opens the AddEvidenceModal from the expanded section (the reported unreachable modal)', async () => {
    render(
      <UnifiedNodeDetailDrawer
        variant="mindmap"
        open
        onClose={vi.fn()}
        nodeData={baseNodeData}
        ideaId="idea-1"
        ideaTitle="Ops efficiency"
        allNodes={[{ id: 'node-1', data: baseNodeData }]}
        allEdges={[]}
        onUpdateNode={vi.fn()}
      />
    );

    const drawer = await screen.findByTestId('unified-node-detail-drawer');
    fireEvent.click(within(drawer).getByRole('button', { name: /Evidence & Sources/i }));
    fireEvent.click(await within(drawer).findByRole('button', { name: /^Add evidence$/i }));

    const modal = await screen.findByRole('dialog', { name: /Add evidence \/ source/i });
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByPlaceholderText(/Evidence title/i)).toBeInTheDocument();
  });
});
