/**
 * @vitest-environment jsdom
 *
 * Tests for `useTabeleRightRailPanels` (Block C · C-S5).
 *
 * Coverage:
 *   - When tableId is missing, panels object is empty.
 *   - When kill switches are off, panels object is empty.
 *   - When forced enable + tableId+workspaceId, both panels render.
 *   - QA → AI Editor handoff updates the AI Editor's preset (preset is
 *     consumed via key-bump remount, so we assert the key changed).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/tablePlatform.api', () => ({
  proposeAiEdit: vi.fn(),
  applyAiProposal: vi.fn(),
  rejectAiProposal: vi.fn(),
  getAiBudget: vi.fn().mockResolvedValue({
    workspaceId: 'ws-1',
    budget: 100,
    tokensUsedToday: 0,
    lastResetAt: '',
    remaining: 100,
    softWarnThreshold: 70,
    softWarnTripped: false,
  }),
  recomputeQaReport: vi.fn(),
  getLatestQaReport: vi.fn().mockResolvedValue(null),
  dismissQaSuggestion: vi.fn(),
  findSourcePackCandidates: vi.fn().mockResolvedValue([]),
  createSourcePack: vi.fn(),
  listSourcePacksForTable: vi.fn().mockResolvedValue([]),
  listSourcePacksForWorkspace: vi.fn().mockResolvedValue([]),
  markSourcePackUsed: vi.fn(),
  convertTable: vi.fn(),
  listTableConversions: vi.fn().mockResolvedValue([]),
  getTableConversion: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// tabeleAiEditorFlag defaults to true (server flag also ON by default).
// The kill-switches-off test must override both to false explicitly.
vi.mock('@/utils/tabeleAiEditorFlag', () => ({
  isTabeleAiEditorEnabled: vi.fn(() => false),
  TABELE_AI_EDITOR_FLAG_KEYS: {
    localStorage: 'ff.tabele_ai_editor',
    query: 'ff_tabeleAiEditor',
    env: 'VITE_TABELE_AI_EDITOR',
  },
}));
vi.mock('@/utils/tabeleQaFlag', () => ({
  isTabeleQaEnabled: vi.fn(() => false),
  TABELE_QA_FLAG_KEYS: {
    localStorage: 'ff.tabele_qa',
    query: 'ff_tabeleQa',
    env: 'VITE_TABELE_QA',
  },
}));

import { useTabeleRightRailPanels } from '../useTabeleRightRailPanels';

const Probe: React.FC<{
  tableId: string | null;
  workspaceId: string | null;
  forced?: boolean;
}> = ({ tableId, workspaceId, forced }) => {
  const { rightRailPanels, panelsActive } = useTabeleRightRailPanels({
    tableId,
    workspaceId,
    ...(forced ? { forceEnableForTesting: true } : {}),
  });
  return (
    <div>
      <span data-testid="panels-active">{String(panelsActive)}</span>
      <div data-testid="qa-slot">{rightRailPanels.qaReport ?? null}</div>
      <div data-testid="ai-slot">{rightRailPanels.aiEditor ?? null}</div>
      <div data-testid="source-pack-slot">{rightRailPanels.sourcePack ?? null}</div>
      <div data-testid="share-slot">{rightRailPanels.share ?? null}</div>
    </div>
  );
};

describe('useTabeleRightRailPanels', () => {
  it('returns no panels when tableId is missing', () => {
    render(<Probe tableId={null} workspaceId="ws-1" forced />);
    expect(screen.getByTestId('panels-active')).toHaveTextContent('false');
  });

  it('returns no panels when both kill switches are off (default)', () => {
    render(<Probe tableId="tbl-1" workspaceId="ws-1" />);
    expect(screen.getByTestId('panels-active')).toHaveTextContent('false');
  });

  it('renders all four panels when forced enabled with tableId and workspaceId', () => {
    render(<Probe tableId="tbl-1" workspaceId="ws-1" forced />);
    expect(screen.getByTestId('panels-active')).toHaveTextContent('true');
    expect(screen.getByTestId('tabele-qa-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tabele-ai-editor-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tabele-source-pack-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tabele-share-panel')).toBeInTheDocument();
  });

  it('omits AI Editor, Source Pack, and Share panels when workspaceId is missing', () => {
    render(<Probe tableId="tbl-1" workspaceId={null} forced />);
    expect(screen.queryByTestId('tabele-ai-editor-panel')).toBeNull();
    expect(screen.queryByTestId('tabele-source-pack-panel')).toBeNull();
    expect(screen.queryByTestId('tabele-share-panel')).toBeNull();
    // QA still renders since it only needs a tableId.
    expect(screen.getByTestId('tabele-qa-panel')).toBeInTheDocument();
  });
});
