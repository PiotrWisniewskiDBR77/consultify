import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaWorkspaceToolbar } from '../../../src/components/MyWork/IdeaWorkspaceToolbar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

const baseProps = {
  onSearch: vi.fn(),
  onShowHelp: vi.fn(),
  onDiscuss: vi.fn(),
};

describe('IdeaWorkspaceToolbar — STREFA GÓRNA command row', () => {
  it('exposes exactly one Teresa entry point (UI-L12: no duplicate AI door)', () => {
    render(<IdeaWorkspaceToolbar {...baseProps} discussDisabled={false} />);
    // The command row owns the single "Discuss with Teresa" entry.
    const teresaEntries = screen.getAllByRole('button', { name: /discuss with teresa/i });
    expect(teresaEntries).toHaveLength(1);
    // The removed "AI Context" duplicate must not resurface here.
    expect(screen.queryByRole('button', { name: /ai context/i })).toBeNull();
  });

  // #6a (2026-07-12, zone split): the icon tool-switcher moved out of this
  // top-right widget into the left rail (CanvasLeftToolbar — see
  // tests/unit/mindmap/canvasLeftToolbar.test.tsx for its coverage). This
  // widget is now search + help + Discuss only (M3-prawa).
  it('no longer renders the canvas tool switcher here (moved to the left rail)', () => {
    render(<IdeaWorkspaceToolbar {...baseProps} discussDisabled={false} />);
    expect(screen.queryByRole('button', { name: /recommendation map/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /whiteboard/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /process flow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^table$/i })).toBeNull();
  });

  it('disables Teresa when the map is empty (empty-state affordance, not a dead click)', () => {
    render(<IdeaWorkspaceToolbar {...baseProps} discussDisabled />);
    const teresa = screen.getByRole('button', { name: /discuss with teresa/i });
    expect(teresa).toBeDisabled();
  });
});
