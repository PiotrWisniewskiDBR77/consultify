/**
 * @vitest-environment jsdom
 *
 * Scope-split regression (M19 Presentation Studio / M20 Table Studio):
 * the "Recent" and "Saved" tabs MUST resolve to different sets. Recent shows
 * every artifact in the lane (incl. drafts / work-in-progress); Saved shows
 * ONLY finalized artifacts (ready/shared/exported/archived/final/…).
 *
 * Before the fix, Saved used a plain `statusKey !== 'draft'` filter, so whenever
 * no row happened to be a draft the two tabs mirrored each other.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/utils/templateLifecycleFlag', () => ({
  isTemplateLifecycleEnabled: () => false,
}));

vi.mock('../templateLifecycle/TabeleTemplatesGrid', () => ({
  TabeleTemplatesGrid: () => null,
}));

vi.mock('../useModuleTemplates', () => ({
  useModuleTemplates: () => ({ templates: [], loading: false }),
}));

const { recentMock } = vi.hoisted(() => ({ recentMock: vi.fn() }));

vi.mock('../useModuleRecentArtifacts', () => ({
  useModuleRecentArtifacts: () => recentMock(),
}));

import { ArtifactModuleHome } from '../ArtifactModuleHome';

const mk = (title: string, statusKey: string) => ({
  kind: 'presentation' as const,
  originRecordId: title,
  artifactId: title,
  title,
  statusKey,
  owner: 'me',
  updatedAt: '2026-06-18T10:00:00.000Z',
});

describe('ArtifactModuleHome — Recent vs Saved scope split', () => {
  beforeEach(() => {
    recentMock.mockReset();
    recentMock.mockReturnValue({
      artifacts: [
        mk('Draft Deck', 'draft'),
        mk('WIP Deck', 'generated'),
        mk('Editing Deck', 'editing'),
        mk('Final Deck', 'ready'),
        mk('Shared Deck', 'shared'),
        mk('Archived Deck', 'archived'),
      ],
      loading: false,
    });
  });

  it('Recent shows every artifact incl. drafts/WIP', () => {
    render(<ArtifactModuleHome lane="prezentacje" />);
    fireEvent.click(screen.getByText('Recent'));

    expect(screen.getByText('Draft Deck')).toBeTruthy();
    expect(screen.getByText('WIP Deck')).toBeTruthy();
    expect(screen.getByText('Editing Deck')).toBeTruthy();
    expect(screen.getByText('Final Deck')).toBeTruthy();
  });

  it('Saved shows ONLY finalized artifacts — a strict subset of Recent', () => {
    render(<ArtifactModuleHome lane="prezentacje" />);
    fireEvent.click(screen.getByText('Saved'));

    // Finalized → present
    expect(screen.getByText('Final Deck')).toBeTruthy();
    expect(screen.getByText('Shared Deck')).toBeTruthy();
    expect(screen.getByText('Archived Deck')).toBeTruthy();

    // Work-in-progress → absent (this is the scope-bug guard)
    expect(screen.queryByText('Draft Deck')).toBeNull();
    expect(screen.queryByText('WIP Deck')).toBeNull();
    expect(screen.queryByText('Editing Deck')).toBeNull();
  });
});
