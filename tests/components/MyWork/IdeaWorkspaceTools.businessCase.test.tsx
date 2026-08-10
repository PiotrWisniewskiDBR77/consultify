/**
 * IdeaWorkspaceTools — Program D / epic E08 wiring check.
 *
 * Verifies the "Karta biznesowa" / "Business case" section (§6.2 schema,
 * `IdeaBusinessCaseSection.tsx`) is actually mounted inside the Przegląd tab
 * of `IdeaWorkspaceTools.tsx` — not just built and left orphaned. Two cases:
 *   1. Flag OFF (default) → section absent, nothing else about the panel
 *      changes (CLAUDE.md rule #7 — default OFF until Piotr accepts a
 *      screenshot).
 *   2. Flag ON (`localStorage['ff.idea_business_case']='1'`) → section
 *      header renders and the empty-but-fully-shaped schema shows its
 *      honest "0 of 14 sections started" progress label.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Heavy inspector widgets are out of scope here — stub them, same as the
// sibling inspector test.
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
import { IDEA_BUSINESS_CASE_FLAG_KEYS } from '../../../src/utils/ideaBusinessCaseSchemaFlag';

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
  graphNodes: [{ id: 'n1', data: { label: 'Node 1' } }],
  graphEdges: [],
};

describe('IdeaWorkspaceTools — business case section wiring (Program D / E08)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('does not render the business case section when the flag is off (default)', () => {
    render(<IdeaWorkspaceTools {...baseProps} />);
    expect(screen.queryByText('Business case')).not.toBeInTheDocument();
  });

  it('renders the business case section, mounted with real content, when the flag is on', async () => {
    window.localStorage.setItem(IDEA_BUSINESS_CASE_FLAG_KEYS.localStorage, '1');
    render(<IdeaWorkspaceTools {...baseProps} />);

    // Section header is present immediately (collapsed by default).
    expect(await screen.findByText('Business case')).toBeInTheDocument();

    // Expand the section and confirm the fourteen-section schema actually
    // rendered (not a stub) via its honest "N of 14" progress label.
    fireEvent.click(screen.getByText('Business case'));
    await waitFor(() => {
      expect(screen.getByText('0 of 14 sections started')).toBeInTheDocument();
    });

    // First §6.2 section (problem/baseline) is present as real editable content.
    expect(screen.getByText('1. Problem & baseline')).toBeInTheDocument();
  });
});
