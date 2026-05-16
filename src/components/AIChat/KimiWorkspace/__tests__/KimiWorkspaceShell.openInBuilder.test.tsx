/**
 * @vitest-environment jsdom
 *
 * Regression guard for the "Open in Builder" wiring in
 * `<KimiWorkspaceShell lane="prezentacje">`.
 *
 * Background: the `2026-05-08_1853_presentations-p2-alignment-retest`
 * QA report verdicted BLOCKED_P1 because the "Otwórz w kreatorze"
 * button looked frozen. Root cause was that the click invoked
 * `window.open(url, '_blank')` directly, which silently failed
 * (popup blocker / new-tab outside operator focus) and bypassed the
 * lane's own observable navigation handler.
 *
 * The fix routes BOTH "Open in Builder" buttons through the existing
 * `onPreviewFile` prop, making the lane component (PrezentacjeView)
 * the single source of truth for the navigation, with toast +
 * structured console feedback. These tests pin that wiring so the
 * regression cannot re-enter through a refactor.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def?: unknown) => (typeof def === 'string' ? def : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/store/useConversationStore', () => {
  const stubState = {
    activeMessages: [],
    setDisplayMode: () => undefined,
    setWorkspaceContext: () => undefined,
  };
  return {
    useConversationStore: (selector: (s: unknown) => unknown) => selector(stubState),
  };
});

vi.mock('../../UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="chat-stub" />,
}));

vi.mock('../tabelePreview/TabelePreviewLayout', () => ({
  default: () => <div data-testid="tabele-preview-stub" />,
}));

import { type ArtifactPreview, KimiWorkspaceShell } from '../KimiWorkspaceShell';

const baseDeckPreview: ArtifactPreview = {
  type: 'deck',
  title: 'Deck regresji',
  deckId: 'deck-abc-123',
  deckStatus: 'reviewed',
  summary: 'Test summary',
  deckSlides: [
    { slideId: 's1', intent: 'cover', title: 'Cover', bulletPoints: ['Hello'] },
    {
      slideId: 's2',
      intent: 'content',
      title: 'Insight',
      bulletPoints: ['Bullet A', 'Bullet B'],
    },
  ],
};

function renderShell(overrides: Partial<React.ComponentProps<typeof KimiWorkspaceShell>> = {}) {
  const defaults: React.ComponentProps<typeof KimiWorkspaceShell> = {
    lane: 'prezentacje',
    taskSteps: [],
    totalSteps: 8,
    completedSteps: 8,
    isGenerating: false,
    isCompleted: true,
    preview: baseDeckPreview,
  };
  return render(<KimiWorkspaceShell {...defaults} {...overrides} />);
}

describe('KimiWorkspaceShell · prezentacje "Open in Builder" wiring', () => {
  it('routes the populated-deck button through onPreviewFile (no window.open)', async () => {
    const onPreviewFile = vi.fn();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderShell({ onPreviewFile });

    const btn = await screen.findByTestId('kimi-open-in-builder-populated');
    await userEvent.click(btn);

    expect(onPreviewFile).toHaveBeenCalledTimes(1);
    expect(windowOpen).not.toHaveBeenCalled();
    windowOpen.mockRestore();
  });

  it('routes the empty-preview button through onPreviewFile when slides are absent', async () => {
    const onPreviewFile = vi.fn();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderShell({
      onPreviewFile,
      preview: { ...baseDeckPreview, deckSlides: [] },
    });

    const btn = await screen.findByTestId('kimi-open-in-builder-empty');
    await userEvent.click(btn);

    expect(onPreviewFile).toHaveBeenCalledTimes(1);
    expect(windowOpen).not.toHaveBeenCalled();
    windowOpen.mockRestore();
  });

  it('omits the populated button when onPreviewFile is not wired (defensive)', () => {
    renderShell({ onPreviewFile: undefined });
    expect(screen.queryByTestId('kimi-open-in-builder-populated')).toBeNull();
    expect(screen.queryByTestId('kimi-open-in-builder-empty')).toBeNull();
  });

  it('omits the populated button when deckId is missing', () => {
    const onPreviewFile = vi.fn();
    renderShell({
      onPreviewFile,
      preview: { ...baseDeckPreview, deckId: undefined },
    });
    expect(screen.queryByTestId('kimi-open-in-builder-populated')).toBeNull();
  });
});
