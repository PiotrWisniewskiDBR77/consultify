/**
 * D-I §3 (UI-L15) — context menus portal to document.body so `fixed`+z-index
 * resolve against the viewport (above canvas nodes), not a transformed ancestor.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContextMenuPortal } from '../../../src/components/MyWork/mindmap/ContextMenuPortal';

describe('ContextMenuPortal', () => {
  it('renders children directly under document.body (escapes canvas stacking context)', () => {
    const { container } = render(
      <div data-testid="host">
        <ContextMenuPortal>
          <div data-testid="menu">menu</div>
        </ContextMenuPortal>
      </div>
    );
    // The menu is NOT inside the host subtree...
    expect(container.querySelector('[data-testid="menu"]')).toBeNull();
    // ...it is a direct child of <body>.
    const menu = document.body.querySelector('[data-testid="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.parentElement).toBe(document.body);
  });
});
