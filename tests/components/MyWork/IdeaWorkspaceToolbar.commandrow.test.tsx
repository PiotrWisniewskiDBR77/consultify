import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

import { IdeaWorkspaceToolbar } from '../../../src/components/MyWork/IdeaWorkspaceToolbar';

// Resolve real English copy from the translation file so accessible-name
// assertions verify actual product copy, not raw i18n keys.
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
