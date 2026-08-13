import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// Resolve real English copy from the translation file so this test verifies the
// actual section titles a user sees (Problem/Status/Convert/Branch/Area), not raw
// i18n keys — falls back to the key itself for anything not present.
function resolveTranslation(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  return typeof value === 'string' ? value : key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => resolveTranslation(key), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Heavy inspector widgets are out of scope for the ≤5-sections contract — stub them.
vi.mock('../../../src/components/MyWork/table/IdeaCompletenessWidget', () => ({
  IdeaCompletenessWidget: () => <div data-testid="completeness" />,
}));
vi.mock('../../../src/components/MyWork/mindmap/MindmapInspector', () => ({
  MindmapInspector: () => <div data-testid="mindmap-inspector" />,
}));
vi.mock('../../../src/components/MyWork/mindmap/MapHealthScore', () => ({
  MapHealthScore: () => <div data-testid="map-health" />,
}));

import { IdeaWorkspaceTools } from '../../../src/components/MyWork/IdeaWorkspaceTools';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-1',
  title: 'My idea',
  seedText: 'seed',
  stage: 'draft',
  branch: '',
  area: '',
  priority: 50,
  isDraft: false,
  isAccepted: true,
  saving: false,
  draftSavedLabel: 'Saved',
  activeTool: 'mindmap' as const,
  selection: { type: 'none' as const, ids: [], count: 0, primaryId: null, meta: null },
  onTitleChange: vi.fn(),
  onSeedTextChange: vi.fn(),
  onBranchChange: vi.fn(),
  onAreaChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onSave: vi.fn(),
  onAcceptChallenge: vi.fn(),
  onConvert: vi.fn(),
  onOpenChat: vi.fn(),
  graphNodes: [{ id: 'n1', data: {} }],
  graphEdges: [],
};

/**
 * TOP-LEVEL inspector sections, identified by the marker the `Section` component
 * stamps on its own header — not by CSS shape.
 *
 * The previous implementation matched `button > span.uppercase` with
 * `tracking-wide` in the class list. That is a visual shape, and shapes are shared:
 * E08's maturity gate renders five NESTED collapsible stage rows (Spark, Growing,
 * Shaping, Ready, Promoted) INSIDE the Status section using exactly the same shape.
 * The count went 5 -> 10 and this guard reported a density regression that did not
 * exist — the panel still has five top-level sections (Problem, Status, Convert,
 * Map inspector, Map health); one of them simply grew an accordion inside it.
 *
 * Verified before changing this: the maturity gate is mounted at
 * IdeaWorkspaceTools.tsx:1110, between the Status section (opens ~L1004) and the
 * Statistics section (~L1260) — i.e. genuinely nested, not a sibling.
 *
 * A shape-based selector cannot express "top-level", so it was replaced rather
 * than loosened. Raising the limit to 10 would have been the wrong fix: it would
 * have retired a real density rule to accommodate a measurement bug.
 */
function sectionHeaderTitles(): string[] {
  return Array.from(document.querySelectorAll('[data-idea-section-header]')).map((s) =>
    (s.textContent || '').trim()
  );
}

describe('IdeaWorkspaceTools — STREFA PRAWA inspector (UI-L16)', () => {
  it('renders at most 5 top-level sections for the mind map', () => {
    render(<IdeaWorkspaceTools {...baseProps} />);
    const titles = sectionHeaderTitles();
    expect(titles.length).toBeLessThanOrEqual(5);
    // Primary sections present.
    expect(titles).toContain('Problem');
    expect(titles).toContain('Status');
    expect(titles).toContain('Convert');
  });

  it('does not render Metadata as a standalone collapsible section', () => {
    render(<IdeaWorkspaceTools {...baseProps} />);
    // "Metadata" must not be a section header — it now lives inside Status as a sub-group.
    expect(sectionHeaderTitles()).not.toContain('Metadata');
    // But the branch/area/priority controls are still reachable (folded in, not deleted).
    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('Area')).toBeInTheDocument();
  });
});
