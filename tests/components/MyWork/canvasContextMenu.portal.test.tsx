/**
 * RESTORES COVERAGE DELETED BY THIS PROGRAM'S FIRST COMMIT.
 *
 * `tests/components/MyWork/ContextMenuPortal.test.tsx` existed at
 * `origin/demo` @ 9d17cac114 and was deleted by `93ebc3aa20`
 * ("E00: forward-port Ideas navigation/context-menu unification"), together
 * with the `src/components/MyWork/mindmap/ContextMenuPortal` component it
 * covered. The deletion itself was legitimate: the unification re-homed the
 * behaviour into the shared `CanvasContextMenu`, which portals via
 * `createPortal(menu, portalTarget ?? document.body)`.
 *
 * What was NOT legitimate is that the ASSERTION went with it. From that commit
 * until now, nothing in the suite proved that context menus still escape the
 * canvas stacking context — the behaviour was correct but untested, which is
 * indistinguishable from correct-by-accident.
 *
 * Why the behaviour matters (verbatim intent of the deleted test, D-I §3 /
 * UI-L15): context menus must render under `document.body` so that `fixed` +
 * `z-index` resolve against the VIEWPORT. A React-Flow canvas ancestor carries
 * a CSS `transform`, and a transformed ancestor establishes a containing block
 * for `position: fixed` descendants — so a menu rendered inside the canvas
 * subtree would be positioned and clipped relative to the panned/zoomed canvas
 * instead of the screen.
 *
 * Found by the E15 round-1 A/B against `origin/demo`: the comparison flags a
 * file present at baseline and absent on the candidate as a first-class
 * finding, on equal footing with a new failure. The previous session's
 * "two clean rounds" reported 0 files losing tests and did not catch this,
 * because it only compared files present on BOTH sides.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CanvasContextMenu } from '../../../src/components/shared/CanvasContextMenu';

function renderInsideTransformedCanvas() {
  return render(
    // Mimics the React-Flow viewport: a transformed ancestor, which is exactly
    // the condition that would trap a `position: fixed` descendant.
    <div data-testid="canvas-host" style={{ transform: 'translate(120px, 80px) scale(1.5)' }}>
      <CanvasContextMenu
        x={10}
        y={20}
        items={[{ id: 'probe', label: 'Probe action', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />
    </div>
  );
}

describe('CanvasContextMenu — portal escape (restores ContextMenuPortal coverage)', () => {
  it('renders the menu OUTSIDE the transformed canvas subtree', () => {
    const { container } = renderInsideTransformedCanvas();

    const host = container.querySelector('[data-testid="canvas-host"]');
    expect(host).not.toBeNull();

    // The menu must NOT be reachable from inside the transformed host…
    expect(host?.querySelector('[data-testid="canvas-context-menu"]')).toBeNull();

    // …but it must exist in the document.
    const menu = document.body.querySelector('[data-testid="canvas-context-menu"]');
    expect(menu).not.toBeNull();
  });

  it('portals the menu to document.body, not to a transformed ancestor', () => {
    renderInsideTransformedCanvas();

    const menu = document.body.querySelector('[data-testid="canvas-context-menu"]');
    expect(menu).not.toBeNull();

    // Walk the real ancestor chain and assert no ancestor carries a transform.
    // This is the property that actually protects `position: fixed`, and it is
    // stronger than asserting a specific parent node: it keeps holding if the
    // portal target is ever changed to another untransformed container.
    let node: HTMLElement | null = menu?.parentElement ?? null;
    const transformedAncestors: string[] = [];
    while (node && node !== document.documentElement) {
      const transform = node.style.transform;
      if (transform && transform !== 'none') {
        transformedAncestors.push(`${node.tagName.toLowerCase()}[transform:${transform}]`);
      }
      node = node.parentElement;
    }
    expect(transformedAncestors).toEqual([]);
  });

  it('keeps the menu itself position:fixed, so the portal is load-bearing', () => {
    renderInsideTransformedCanvas();

    // If the menu were not `fixed`, escaping the stacking context would be
    // pointless — the two facts only protect the user together.
    const menu = screen.getByTestId('canvas-context-menu');
    expect(menu.className).toContain('fixed');
  });
});
