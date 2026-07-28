/**
 * @vitest-environment jsdom
 *
 * Tests for `<RightRail>` — P-01 (2026-07-28, zgłoszenie Piotra):
 * „prawy panel nie może zwijać się do zera — szyna ikon ma zostać zawsze
 * widoczna, uchwyt rozwijania siedzi NA szynie".
 *
 * Coverage:
 *   * Icon strip renders (uncollapsed, no active tool).
 *   * `collapsed=true` KEEPS the tool icons in the DOM and clickable —
 *     this is the regression guard for the bug: before the fix, collapsed
 *     rendered a 16 px sliver with zero tool icons.
 *   * `collapsed=true` hides the side PANEL even if a tool is active.
 *   * Clicking a tool icon while collapsed selects the tool AND calls
 *     `onToggleCollapse` (one gesture opens the panel).
 *   * Clicking the toggle handle while collapsed calls `onToggleCollapse`
 *     (handle lives on the rail itself, not a separate edge sliver).
 *   * Re-clicking the already-active tool while expanded closes the panel
 *     without collapsing the rail (existing behaviour preserved).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Link2, MessageSquare } from 'lucide-react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RightRail, type RightRailToolDescriptor } from '../RightRail';

const TOOLS: RightRailToolDescriptor[] = [
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'relations', label: 'Relations', icon: Link2 },
];

function renderRail(overrides: Partial<React.ComponentProps<typeof RightRail>> = {}) {
  const onSelectTool = vi.fn();
  const onToggleCollapse = vi.fn();
  const utils = render(
    <RightRail
      tools={TOOLS}
      activeToolId={null}
      onSelectTool={onSelectTool}
      panelContent={<div data-testid="panel-stub">Panel</div>}
      panelWidth={320}
      collapsed={false}
      onToggleCollapse={onToggleCollapse}
      {...overrides}
    />
  );
  return { ...utils, onSelectTool, onToggleCollapse };
}

describe('RightRail — P-01 icon strip never disappears', () => {
  it('renders the icon strip when expanded', () => {
    renderRail();
    expect(screen.getByTestId('mels-right-rail-tool-comments')).toBeInTheDocument();
    expect(screen.getByTestId('mels-right-rail-tool-relations')).toBeInTheDocument();
    expect(screen.getByTestId('mels-right-rail').getAttribute('data-collapsed')).toBe('false');
  });

  it('keeps tool icons in the DOM and clickable when collapsed (regression guard)', () => {
    renderRail({ collapsed: true, activeToolId: 'comments' });
    const rail = screen.getByTestId('mels-right-rail');
    expect(rail.getAttribute('data-collapsed')).toBe('true');
    // The bug (pre-P-01): collapsed rendered a 16px sliver — NO tool
    // buttons at all. Guard: both tools must still be present + enabled.
    const commentsBtn = screen.getByTestId('mels-right-rail-tool-comments');
    const relationsBtn = screen.getByTestId('mels-right-rail-tool-relations');
    expect(commentsBtn).toBeInTheDocument();
    expect(relationsBtn).toBeInTheDocument();
    expect(commentsBtn).not.toBeDisabled();
    expect(relationsBtn).not.toBeDisabled();
  });

  it('hides the side panel when collapsed even if a tool is active', () => {
    renderRail({ collapsed: true, activeToolId: 'comments' });
    expect(screen.queryByTestId('mels-right-rail-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-stub')).not.toBeInTheDocument();
  });

  it('clicking a tool icon while collapsed selects the tool AND expands the panel', () => {
    const { onSelectTool, onToggleCollapse } = renderRail({
      collapsed: true,
      activeToolId: null,
    });
    fireEvent.click(screen.getByTestId('mels-right-rail-tool-relations'));
    expect(onSelectTool).toHaveBeenCalledWith('relations');
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('clicking the toggle handle while collapsed calls onToggleCollapse', () => {
    const { onToggleCollapse } = renderRail({ collapsed: true });
    fireEvent.click(screen.getByTestId('mels-right-rail-toggle'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('re-clicking the active tool while expanded closes the panel without collapsing', () => {
    const { onSelectTool, onToggleCollapse } = renderRail({
      collapsed: false,
      activeToolId: 'comments',
    });
    fireEvent.click(screen.getByTestId('mels-right-rail-tool-comments'));
    expect(onSelectTool).toHaveBeenCalledWith(null);
    expect(onToggleCollapse).not.toHaveBeenCalled();
  });

  it('panel width stays at the icon-strip width (56px equivalent) when collapsed', () => {
    renderRail({ collapsed: true, activeToolId: 'comments' });
    const rail = screen.getByTestId('mels-right-rail');
    // 56px icon strip only — no panel width added while collapsed.
    expect(rail.style.width).toBe('56px');
  });
});
