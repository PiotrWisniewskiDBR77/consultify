/**
 * Tests for CanvasLeftToolbar: correct slots per activeTool, event dispatch.
 */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
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

import { CanvasLeftToolbar } from '@/components/MyWork/mindmap/CanvasLeftToolbar';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

const baseProps = {
  activeTool: 'mindmap' as const,
  selection: EMPTY_SELECTION,
  isAccepted: true,
  ideaId: 'test-123',
  onAction: vi.fn(),
  onOpenChat: vi.fn(),
  onApplyTemplate: vi.fn(),
  onOpenTemplateGallery: vi.fn(),
};

describe('CanvasLeftToolbar', () => {
  it('renders when isAccepted is true', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('still renders the toolbar shell when isAccepted is false', () => {
    render(<CanvasLeftToolbar {...baseProps} isAccepted={false} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders mindmap-specific slots (GitBranch for Add node)', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    const addNodeBtn = buttons.find((b) => b.getAttribute('title') === 'Add node');
    expect(addNodeBtn).toBeTruthy();
  });

  it('dispatches action on immediate button click', () => {
    const onAction = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} onAction={onAction} />);
    const selectBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title')?.startsWith('Select'));
    if (selectBtn) fireEvent.click(selectBtn);
    expect(onAction).toHaveBeenCalledWith('mm_pan_mode');
  });

  it('toggles connect back to select when already in connect mode', () => {
    const onAction = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} interactionMode="connect" onAction={onAction} />);

    const connectBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Finish connecting and return to select');

    if (connectBtn) fireEvent.click(connectBtn);
    expect(onAction).toHaveBeenCalledWith('mm_select_mode');
    expect(
      screen
        .getAllByRole('button')
        .find(
          (b) =>
            b.getAttribute('title') ===
            'Connect — click Connect or empty canvas to return to select'
        )
    ).toBeTruthy();
  });

  it('opens AI popover on click', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const aiBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'AI');
    expect(aiBtn).toBeTruthy();
    if (aiBtn) fireEvent.click(aiBtn);
    expect(screen.getByText('New AI conversation')).toBeTruthy();
  });

  it('renders undo/redo buttons', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.find((b) => b.getAttribute('title') === 'Undo')).toBeTruthy();
    expect(buttons.find((b) => b.getAttribute('title') === 'Redo')).toBeTruthy();
  });

  // #6a (2026-07-12, zone split): the canvas tool switcher relocated here
  // from the top-right IdeaWorkspaceToolbar widget. It's opt-in via
  // `onToolChange` so embeds that don't need it (none today) keep working.
  it('renders the tool switcher (RAIL zone) when onToolChange is provided', () => {
    render(<CanvasLeftToolbar {...baseProps} onToolChange={vi.fn()} />);
    expect(screen.getByTestId('canvas-left-toolbar-switch-mindmap')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-left-toolbar-switch-whiteboard')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-left-toolbar-switch-process_flow')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-left-toolbar-switch-table')).toBeInTheDocument();
  });

  it('omits the tool switcher entirely when onToolChange is not provided', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    expect(screen.queryByTestId('canvas-left-toolbar-switch-mindmap')).toBeNull();
  });

  it('switching tools calls onToolChange with the clicked tool id', () => {
    const onToolChange = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} onToolChange={onToolChange} />);
    fireEvent.click(screen.getByTestId('canvas-left-toolbar-switch-process_flow'));
    expect(onToolChange).toHaveBeenCalledWith('process_flow');
  });

  /**
   * D2 (2026-07-28): siatka i przyciąganie przeniesione z bezpodpisowej nakładki
   * nad płótnem Przepływu (zasłaniała pstryczek zwijania pierwszego toru) do
   * tego raila. Strażnik pilnuje dwóch rzeczy naraz: że sloty w ogóle istnieją
   * w Przepływie i że NIE wyciekają do pozostałych trzech reprezentacji, gdzie
   * `pf_toggle_*` nie ma odbiornika (mechanizm `liveIn`).
   */
  it('Przepływ ma na railu pstryczki siatki i przyciągania', () => {
    const onAction = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} activeTool="process_flow" onAction={onAction} />);
    fireEvent.click(screen.getByTestId('canvas-left-toolbar-pf_grid'));
    expect(onAction).toHaveBeenCalledWith('pf_toggle_grid');
    fireEvent.click(screen.getByTestId('canvas-left-toolbar-pf_snap'));
    expect(onAction).toHaveBeenCalledWith('pf_toggle_snap');
  });

  it.each(['mindmap', 'whiteboard', 'table'] as const)(
    'siatka i przyciąganie nie pojawiają się w reprezentacji %s',
    (tool) => {
      render(<CanvasLeftToolbar {...baseProps} activeTool={tool} />);
      expect(screen.queryByTestId('canvas-left-toolbar-pf_grid')).toBeNull();
      expect(screen.queryByTestId('canvas-left-toolbar-pf_snap')).toBeNull();
    }
  );

  it('pstryczek siatki pokazuje stan włączenia (aria-pressed)', () => {
    render(<CanvasLeftToolbar {...baseProps} activeTool="process_flow" />);
    // Domyślnie oba włączone (tak startuje IdeaProcessFlowTool)…
    expect(screen.getByTestId('canvas-left-toolbar-pf_grid')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // …a stan przychodzi z płótna zdarzeniem, nie z klikania w rail.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('process-flow-grid-state', { detail: { showGrid: false, snap: true } })
      );
    });
    expect(screen.getByTestId('canvas-left-toolbar-pf_grid')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByTestId('canvas-left-toolbar-pf_snap')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
