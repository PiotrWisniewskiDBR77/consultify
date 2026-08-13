import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getActionsForSurface } from '../../../src/actions/ideaActionRegistry';
import { CanvasLeftToolbar } from '../../../src/components/MyWork/mindmap/CanvasLeftToolbar';
import { EMPTY_SELECTION } from '../../../src/components/MyWork/ideaSelectionTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

// Tier A rail wiring (2026-08-10): CanvasLeftToolbar.tsx now imports
// `@/actions/ideaActionRegistry`, which pulls in `@/services/api` (→ `src/i18n.ts`,
// which needs a real `initReactI18next`, added above) — mocked here the same way
// `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` already does for the same
// transitive chain, to keep this test hermetic.
vi.mock('@/services/api', () => ({
  API_URL: 'http://localhost/test-api',
  getHeaders: () => ({}),
}));

// The popovers are irrelevant to the floating-geometry contract; stub them out so the
// test stays focused on STREFA LEWA (Editor Shell Canon §2 / UI-L1).
vi.mock('../../../src/components/MyWork/mindmap/toolbar-popovers/AddNodePopover', () => ({
  AddNodePopover: () => null,
}));
// Tier B rail wiring (2026-08-10): the AI popover is the surface whose ITEMS now
// route through the action registry, so this stub renders two real buttons —
// one action the registry knows on `surface: 'rail'` (mm_ai_gap_analysis) and one
// it does not (mm_add_knowledge). Both must still reach `onAction` unchanged.
vi.mock('../../../src/components/MyWork/mindmap/toolbar-popovers/AIActionsPopover', () => ({
  AIActionsPopover: ({ onAction }: { onAction: (action: string) => void }) => (
    <div>
      <button data-testid="stub-ai-known" onClick={() => onAction('mm_ai_gap_analysis')}>
        known
      </button>
      <button data-testid="stub-ai-unknown" onClick={() => onAction('mm_add_knowledge')}>
        unknown
      </button>
    </div>
  ),
}));
vi.mock('../../../src/components/MyWork/mindmap/toolbar-popovers/ImportExportPopover', () => ({
  ImportExportPopover: () => null,
}));
vi.mock('../../../src/components/MyWork/mindmap/toolbar-popovers/KnowledgePopover', () => ({
  KnowledgePopover: () => null,
}));
vi.mock('../../../src/components/MyWork/mindmap/toolbar-popovers/MoreToolsPanel', () => ({
  MoreToolsPanel: () => null,
}));
vi.mock('../../../src/components/MyWork/mindmap/toolbar-popovers/TemplatesPopover', () => ({
  TemplatesPopover: () => null,
}));

const baseProps = {
  activeTool: 'mindmap' as const,
  selection: EMPTY_SELECTION,
  isAccepted: true,
  onAction: vi.fn(),
  onOpenChat: vi.fn(),
  onApplyTemplate: vi.fn(),
  onOpenTemplateGallery: vi.fn(),
};

function findRail(): HTMLElement {
  // The rail is the portaled container that holds the pointer-toggle button.
  const pointer = screen.getByTestId('canvas-left-toolbar-add');
  const rail = pointer.closest('div.fixed');
  expect(rail).toBeTruthy();
  return rail as HTMLElement;
}

describe('CanvasLeftToolbar — STREFA LEWA floating (UI-L1)', () => {
  it('falls back to the viewport-edge class when no canvas container ref is given', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const rail = findRail();
    expect(rail.className).toContain('left-3');
    expect(rail.style.left).toBe('');
  });

  it('anchors to the canvas container left edge (not the app sidebar) when a ref is provided', () => {
    const el = document.createElement('div');
    // Simulate a canvas that starts 260px from the viewport edge (i.e. right of the app sidebar).
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 260,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 740,
      height: 800,
      x: 260,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const ref = { current: el } as React.RefObject<HTMLElement>;

    render(<CanvasLeftToolbar {...baseProps} canvasContainerRef={ref} />);
    const rail = findRail();
    // 260 (canvas left) + 12 (left-3 inset) = 272px — on the canvas, clear of the sidebar.
    expect(rail.style.left).toBe('272px');
    expect(rail.className).not.toContain('left-3');
  });
});

/**
 * Tier B rail wiring (2026-08-10, Program B/E02). Ryzyko, przed którym broni ten
 * blok: `handlePopoverAction` przestał być gołym `onAction(action)` — teraz
 * najpierw pyta rejestr. Gdyby wyszukiwanie kiedyś POŁKNĘŁO klik (brak wpisu
 * potraktowany jako „obsłużone", albo `ctx.params.run` przestało być wołane),
 * KAŻDA pozycja KAŻDEGO popovera raila zamilkłaby po cichu — we wszystkich
 * czterech reprezentacjach naraz (jeden wspólny komponent).
 */
describe('CanvasLeftToolbar — pozycje popovera przez rejestr (rail tier B)', () => {
  const openAiPopover = () => {
    fireEvent.click(screen.getByTestId('canvas-left-toolbar-ai'));
  };

  it('akcja ZNANA rejestrowi na powierzchni rail nadal woła onAction tym samym stringiem', async () => {
    // Kontrola pozytywna wprost z rejestru — bez niej test przeszedłby także
    // wtedy, gdyby wpis zniknął i klik poleciał zwykłą ścieżką awaryjną.
    const railIds = getActionsForSurface('rail', { tool: 'mindmap' }).map((a) => a.def.id);
    expect(railIds).toContain('idea.ai.gap_analysis');

    const onAction = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} onAction={onAction} ideaId="idea-1" />);
    openAiPopover();
    fireEvent.click(screen.getByTestId('stub-ai-known'));

    // Ścieżka rejestru jest asynchroniczna (`runIdeaAction` zwraca Promise),
    // ale MUSI skończyć się dokładnie tym samym wywołaniem co przed migracją.
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('mm_ai_gap_analysis'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('akcja NIEZNANA rejestrowi leci starą ścieżką, natychmiast i bez zmian (Z3)', () => {
    const railIds = getActionsForSurface('rail', { tool: 'mindmap' })
      .map((a) => a.def.runtime?.mindmap)
      .filter(Boolean);
    expect(railIds).not.toContain('mm_add_knowledge');

    const onAction = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} onAction={onAction} ideaId="idea-1" />);
    openAiPopover();
    fireEvent.click(screen.getByTestId('stub-ai-unknown'));

    // Bez `await` — brak wpisu MUSI znaczyć „zero pośrednictwa", nie „później".
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('mm_add_knowledge');
  });
});
