import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaWorkspaceToolbar } from '../../../src/components/MyWork/IdeaWorkspaceToolbar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

const baseProps = {
  activeTool: 'mindmap' as const,
  onToolChange: vi.fn(),
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

  it('keeps the canvas tool switcher as a single segmented control (UI-L13)', () => {
    render(<IdeaWorkspaceToolbar {...baseProps} discussDisabled={false} />);
    // One button per canvas tool — no cryptic duplicate mode rows.
    expect(screen.getByRole('button', { name: /recommendation map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whiteboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /process flow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^table$/i })).toBeInTheDocument();
  });

  it('disables Teresa when the map is empty (empty-state affordance, not a dead click)', () => {
    render(<IdeaWorkspaceToolbar {...baseProps} discussDisabled />);
    const teresa = screen.getByRole('button', { name: /discuss with teresa/i });
    expect(teresa).toBeDisabled();
  });
});
