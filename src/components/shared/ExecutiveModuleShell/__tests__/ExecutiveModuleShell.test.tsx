/**
 * @vitest-environment jsdom
 *
 * Smoke tests for `ExecutiveModuleShell` (EPIC-T16 D1).
 *
 * Coverage:
 *   * Renders top bar, left rail, canvas, right rail.
 *   * Top bar chips appear in MELS canonical order.
 *   * Left rail collapse toggle flips the data-collapsed attribute.
 *   * Right rail tool selection opens the panel; second click closes.
 *   * Canvas content is mounted inside `mels-canvas`.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { Search, ShieldCheck, Sparkles } from 'lucide-react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExecutiveModuleShell } from '../index';

function renderShell(overrides: Partial<React.ComponentProps<typeof ExecutiveModuleShell>> = {}) {
  return render(
    <ExecutiveModuleShell
      moduleKey="tabele-test"
      moduleLabel="Tabele"
      title="Sample artifact"
      topBarChips={[
        { id: 'history', label: 'History', icon: Sparkles },
        { id: 'internal', label: 'Internal', icon: ShieldCheck, dotTone: 'success' },
        { id: 'run', label: 'Run', kind: 'primary' },
      ]}
      leftRailContent={<div data-testid="left-rail-stub">Left items</div>}
      rightRailTools={[
        { id: 'search', label: 'Search', icon: Search },
        { id: 'ai-editor', label: 'AI Editor', icon: Sparkles },
      ]}
      renderRightRailPanel={(activeToolId) =>
        activeToolId ? <div data-testid="right-rail-panel-stub">Panel: {activeToolId}</div> : null
      }
      canvas={<div data-testid="canvas-stub">Canvas content</div>}
      persistRailState={false}
      {...overrides}
    />
  );
}

describe('ExecutiveModuleShell', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the four MELS zones', () => {
    renderShell();
    expect(screen.getByTestId('mels-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mels-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('mels-left-rail')).toBeInTheDocument();
    expect(screen.getByTestId('mels-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('mels-right-rail')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-stub')).toBeInTheDocument();
  });

  it('collapses side rails below the sm breakpoint so the canvas keeps the mobile width', () => {
    renderShell({ aiEntrySlot: <div>AI entry</div> });
    expect(screen.getByTestId('mels-left-rail')).toHaveClass('hidden', 'sm:flex');
    expect(screen.getByTestId('mels-right-rail')).toHaveClass('hidden', 'sm:flex');
    expect(screen.getByTestId('mels-ai-entry')).toHaveClass('hidden', 'sm:flex');
    expect(screen.getByTestId('mels-canvas')).toHaveClass('min-w-0');
  });

  it('orders top bar chips by canonical MELS order', () => {
    renderShell();
    const chipsRow = screen.getByTestId('mels-topbar-chips');
    const chipIds = within(chipsRow)
      .getAllByRole('button')
      .map((btn) => btn.getAttribute('data-mels-chip'));
    // Internal (1) → History (3) → Run (10) — even though we passed
    // them as History, Internal, Run, the shell sorts by MELS_CHIP_ORDER.
    expect(chipIds).toEqual(['internal', 'history', 'run']);
  });

  it('left rail toggle flips data-collapsed', () => {
    renderShell();
    const rail = screen.getByTestId('mels-left-rail');
    expect(rail.getAttribute('data-collapsed')).toBe('false');
    fireEvent.click(screen.getByTestId('mels-left-rail-toggle'));
    expect(rail.getAttribute('data-collapsed')).toBe('true');
  });

  it('right rail tool click opens the panel and re-click closes it', () => {
    renderShell();
    expect(screen.queryByTestId('right-rail-panel-stub')).not.toBeInTheDocument();
    const aiEditorBtn = screen.getByTestId('mels-right-rail-tool-ai-editor');
    fireEvent.click(aiEditorBtn);
    expect(screen.getByTestId('right-rail-panel-stub')).toHaveTextContent('Panel: ai-editor');
    fireEvent.click(aiEditorBtn);
    expect(screen.queryByTestId('right-rail-panel-stub')).not.toBeInTheDocument();
  });

  it('renders the canvas content inside the canvas slot', () => {
    renderShell();
    const canvas = screen.getByTestId('mels-canvas');
    expect(within(canvas).getByTestId('canvas-stub')).toBeInTheDocument();
  });

  it('marks data-mels-module with the supplied moduleKey', () => {
    renderShell({ moduleKey: 'wordy-x' });
    expect(screen.getByTestId('mels-shell').getAttribute('data-mels-module')).toBe('wordy-x');
  });

  it('⌘/ opens the built-in shortcut help modal; Escape closes it', () => {
    renderShell();
    expect(screen.queryByTestId('mels-shortcut-help')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: '/', metaKey: true });
    expect(screen.getByTestId('mels-shortcut-help')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('mels-shortcut-help')).not.toBeInTheDocument();
  });

  it('helpModalTitle=null disables the built-in modal entirely', () => {
    renderShell({ helpModalTitle: null });
    fireEvent.keyDown(window, { key: '/', metaKey: true });
    expect(screen.queryByTestId('mels-shortcut-help')).not.toBeInTheDocument();
  });

  it('left rail exposes a resize handle that drives setLeftWidth', () => {
    renderShell();
    const handle = screen.getByTestId('mels-rail-resize-left');
    expect(handle).toBeInTheDocument();
    // Smoke: arrow keys fire onResize through useRailState; we don't
    // need to assert the next pixel here — `useRailState.test.ts`
    // covers the clamping contract.
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
  });
});
