import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

import { useFullscreenPortalTarget } from '@/hooks/useFullscreenPortalTarget';

export interface CanvasContextMenuItemDescriptor {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  separatorAfter?: boolean;
  groupLabel?: string;
  /** Keep the surface open while the command manages an async lifecycle. */
  closeOnSelect?: boolean;
  onSelect: () => void;
  /**
   * MM-P2 (2026-08-10): nested flyout items. Presence of `children` turns the
   * row into a SUBMENU TRIGGER — `onSelect`/`shortcut` are ignored for it (a
   * trigger never runs a command itself, it only opens/closes its flyout).
   * One nesting level only (children of children are not supported — no
   * current caller needs it, and a second level would need its own overflow
   * math). Generic: any `CanvasContextMenu` consumer can use this, not just
   * Mind Map — Whiteboard/Process Flow/Table menus keep working unchanged
   * because a flat `items` array (no `children` anywhere) renders byte-for-
   * byte like before this change (same buttons, same classes, same a11y).
   */
  children?: CanvasContextMenuItemDescriptor[];
}

export interface CanvasContextMenuProps {
  x: number;
  y: number;
  items: CanvasContextMenuItemDescriptor[];
  onClose: () => void;
  ariaLabel?: string;
  header?: React.ReactNode;
  minWidth?: number;
  testId?: string;
}

const VIEWPORT_GAP = 12;

function getCanvasBounds() {
  const canvasRect = document
    .querySelector<HTMLElement>('[data-testid="mels-canvas"]')
    ?.getBoundingClientRect();
  return (
    canvasRect ?? {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
    }
  );
}

/** Shared row renderer — used for both the top-level menu and any open
 * submenu flyout, so the two visual surfaces stay pixel-identical. */
function MenuRow({
  item,
  index,
  items,
  submenuOpen,
  active,
  onTriggerSubmenu,
  onSelectLeaf,
  onItemFocus,
  registerSubmenuAnchor,
}: {
  item: CanvasContextMenuItemDescriptor;
  index: number;
  items: CanvasContextMenuItemDescriptor[];
  submenuOpen: boolean;
  /** CB-05 roving tabIndex: true for the ONE menuitem currently in the Tab
   * order (`tabindex="0"`) — every other row gets `tabindex="-1"`. */
  active: boolean;
  onTriggerSubmenu: (id: string, open: boolean) => void;
  onSelectLeaf: (item: CanvasContextMenuItemDescriptor) => void;
  /** Fired on the row's native `focus` event — this is what makes the roving
   * tabIndex FOLLOW focus regardless of how focus got there (open-focus
   * effect, ArrowUp/Down/Home/End, or a mouse click), instead of every
   * focus-moving call site having to also remember to update the index. */
  onItemFocus: (id: string) => void;
  registerSubmenuAnchor: (id: string, el: HTMLButtonElement | null) => void;
}) {
  const hasChildren = !!item.children?.length;
  return (
    <React.Fragment>
      {item.groupLabel && item.groupLabel !== items[index - 1]?.groupLabel ? (
        <div className="px-2.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-c-text-muted">
          {item.groupLabel}
        </div>
      ) : null}
      {item.separatorBefore ? (
        <div role="separator" className="mx-2 my-0.5 border-t border-c-border-subtle" />
      ) : null}
      <button
        ref={hasChildren ? (el) => registerSubmenuAnchor(item.id, el) : undefined}
        type="button"
        role="menuitem"
        tabIndex={active ? 0 : -1}
        disabled={item.disabled}
        aria-disabled={item.disabled || undefined}
        aria-haspopup={hasChildren ? 'menu' : undefined}
        aria-expanded={hasChildren ? submenuOpen : undefined}
        title={
          item.disabled && item.disabledReason
            ? `${item.label} — ${item.disabledReason}`
            : item.label
        }
        onMouseEnter={() => onTriggerSubmenu(item.id, hasChildren && !item.disabled)}
        onFocus={() => onItemFocus(item.id)}
        onClick={() => {
          if (item.disabled) return;
          if (hasChildren) {
            onTriggerSubmenu(item.id, !submenuOpen);
            return;
          }
          onSelectLeaf(item);
        }}
        onKeyDown={
          hasChildren && !item.disabled
            ? (event) => {
                // Only ArrowRight is handled explicitly (always OPEN, never
                // toggle) — Enter/Space fall through to the native button
                // click, which already toggles via `onClick` above. Handling
                // them here too would double-fire the toggle in browsers that
                // synthesize a click from Enter/Space after `keydown`.
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  onTriggerSubmenu(item.id, true);
                }
              }
            : undefined
        }
        className={`flex min-h-11 w-full items-center gap-2 px-2.5 text-left text-[13px] leading-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          item.danger
            ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20'
            : 'text-c-text hover:bg-c-surface-raised'
        } ${submenuOpen ? 'bg-c-surface-raised' : ''}`}
        data-command-id={item.id}
      >
        {item.icon ? (
          <span className="shrink-0" aria-hidden="true">
            {item.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">{item.label}</span>
        {hasChildren ? (
          <ChevronRight size={13} className="shrink-0 text-c-text-muted" aria-hidden="true" />
        ) : item.shortcut ? (
          <kbd className="ml-2 text-[9px] text-c-text-muted">{item.shortcut}</kbd>
        ) : null}
      </button>
      {item.separatorAfter ? (
        <div role="separator" className="mx-2 my-0.5 border-t border-c-border-subtle" />
      ) : null}
    </React.Fragment>
  );
}

/** Flyout panel for one open submenu — anchored beside its trigger row,
 * flipped to the opposite side when it would overflow the canvas bounds. */
function SubmenuFlyout({
  anchorRect,
  items,
  minWidth,
  portalTarget,
  onSelectLeaf,
  onRequestClose,
}: {
  anchorRect: DOMRect;
  items: CanvasContextMenuItemDescriptor[];
  minWidth: number;
  portalTarget: Element;
  onSelectLeaf: (item: CanvasContextMenuItemDescriptor) => void;
  onRequestClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchorRect.right, top: anchorRect.top });
  const [maxHeight, setMaxHeight] = useState<number | undefined>();
  // CB-05 roving tabIndex — own tracked "active" row, same contract as the
  // top-level menu below (separate DOM/portal subtree, so a separate index).
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const bounds = getCanvasBounds();
    const availableHeight = Math.max(160, bounds.bottom - bounds.top - VIEWPORT_GAP * 2);
    setMaxHeight(availableHeight);
    const overflowsRight = anchorRect.right + rect.width + 2 > bounds.right - VIEWPORT_GAP;
    const left = overflowsRight
      ? Math.max(bounds.left + VIEWPORT_GAP, anchorRect.left - rect.width - 2)
      : Math.min(anchorRect.right + 2, bounds.right - rect.width - VIEWPORT_GAP);
    const top = Math.max(
      bounds.top + VIEWPORT_GAP,
      Math.min(anchorRect.top, bounds.bottom - Math.min(rect.height, availableHeight) - VIEWPORT_GAP)
    );
    setPosition({ left, top });
  }, [anchorRect, items.length]);

  // Auto-focus the first enabled item once the flyout is positioned — mirrors
  // the top-level menu's own open-focus behavior (see the `useLayoutEffect`
  // in `CanvasContextMenu` below) so keyboard users landing here via
  // ArrowRight/Enter get a focused item immediately, not just an open panel.
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, []);

  const focusByOffset = (offset: number) => {
    const buttons = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(current + offset + buttons.length) % buttons.length]?.focus({ preventScroll: true });
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-context-menu overflow-y-auto rounded-xl border border-c-border-subtle bg-c-surface py-1 shadow-xl"
      style={{ left: position.left, top: position.top, minWidth, maxHeight }}
      onMouseLeave={onRequestClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'ArrowLeft') {
          event.preventDefault();
          onRequestClose();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusByOffset(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusByOffset(-1);
        }
      }}
    >
      {items.map((child, idx) => (
        <MenuRow
          key={child.id}
          item={child}
          index={idx}
          items={items}
          submenuOpen={false}
          active={child.id === activeItemId}
          onTriggerSubmenu={() => undefined}
          onSelectLeaf={onSelectLeaf}
          onItemFocus={setActiveItemId}
          registerSubmenuAnchor={() => undefined}
        />
      ))}
    </div>,
    portalTarget
  );
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x,
  y,
  items,
  onClose,
  ariaLabel = 'Canvas actions',
  header,
  minWidth = 200,
  testId = 'canvas-context-menu',
}) => {
  const portalTarget = useFullscreenPortalTarget();
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)
  );
  const [position, setPosition] = useState({ left: x, top: y });
  const [maxHeight, setMaxHeight] = useState<number | undefined>();
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const submenuAnchors = useRef<Record<string, HTMLButtonElement | null>>({});
  // CB-05 roving tabIndex: id of the ONE menuitem with tabindex="0". Kept in
  // lockstep with DOM focus via `MenuRow`'s `onFocus` — every focus-moving
  // call site below (open-focus layout effect, ArrowUp/Down, Home/End) just
  // calls `.focus()` as before; this state follows automatically instead of
  // needing its own bespoke update at each call site.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Focus-restore-on-close — reuses the SAME mechanism as useDialogA11y
  // (`src/components/ui/primitives/useDialogA11y.ts`): capture the trigger on
  // mount, restore it from an unmount-effect CLEANUP, not a
  // requestAnimationFrame callback fired from the close handler.
  //
  // Why this matters: this component unmounts as a direct result of
  // `onClose()` (every consumer conditionally renders it — see the
  // consumers listed at `isInsideAnyMenuSurface` below). React 18/testing-
  // library flushes that unmount, and this effect's cleanup, SYNCHRONOUSLY
  // inside the `act()` that wraps `fireEvent`. A `requestAnimationFrame`
  // scheduled from the click/Escape handler does NOT run inside that same
  // flush — it fires on the next real animation frame, which is why a
  // caller asserting `document.activeElement` immediately after Escape (no
  // awaited frame — see `whiteboardContextMenu.keyboard.integration.test.tsx`
  // and `IdeaCanvasContextMenu.cb05.test.tsx`) always observed
  // `document.body`, never the trigger. Restoring from the unmount cleanup
  // makes it visible in the same synchronous flush that removed the menu.
  useEffect(() => {
    return () => {
      const trigger = returnFocusRef.current;
      if (trigger && document.contains(trigger)) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  const closeAndRestore = React.useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSelectLeaf = React.useCallback(
    (item: CanvasContextMenuItemDescriptor) => {
      if (item.disabled) return;
      item.onSelect();
      if (item.closeOnSelect !== false) closeAndRestore();
      else setOpenSubmenuId(null);
    },
    [closeAndRestore]
  );

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const bounds = getCanvasBounds();
    const availableHeight = Math.max(176, bounds.bottom - bounds.top - VIEWPORT_GAP * 2);
    setMaxHeight(availableHeight);
    setPosition({
      left: Math.max(
        bounds.left + VIEWPORT_GAP,
        Math.min(x, bounds.right - rect.width - VIEWPORT_GAP)
      ),
      top: Math.max(
        bounds.top + VIEWPORT_GAP,
        Math.min(y, bounds.bottom - Math.min(rect.height, availableHeight) - VIEWPORT_GAP)
      ),
    });
    menu
      .querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, [items.length, x, y]);

  // A submenu flyout is a SEPARATE portal (its own DOM subtree, outside
  // `menuRef`) — `menuRef.current.contains(...)` alone would treat every
  // click/scroll inside an open flyout as "outside" and slam the whole PPM
  // shut mid-selection. Both surfaces carry `role="menu"`, so `closest`
  // covers either one generically (works the same for any future 2nd flyout).
  const isInsideAnyMenuSurface = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[role="menu"]');

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!isInsideAnyMenuSurface(event.target)) closeAndRestore();
    };
    // Escape from OUTSIDE the menu surface.
    //
    // The `onKeyDown` on the menu div below is a React synthetic handler, so it only
    // sees keys whose target is inside the menu. That covers the normal path, because
    // the menu focuses its first item on open. It does NOT cover the case where focus
    // has since moved elsewhere — and before the context menus were unified onto this
    // shared component, each tool's own menu listened on `document` and closed on
    // Escape from anywhere. That robustness was silently lost for all seven consumers
    // (Mind Map pane/node/edge, Whiteboard edge, Process Flow, Idea canvas, Table).
    // Caught by `processflow-panels.test.tsx > closes on Escape key`, which passed at
    // `origin/demo` and failed on the candidate.
    //
    // Guarded on the target being OUTSIDE any menu surface, so this never double-fires
    // with the React handler — each Escape is handled by exactly one of the two.
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isInsideAnyMenuSurface(event.target)) return;
      event.preventDefault();
      closeAndRestore();
    };
    const onViewportChange = (event: Event) => {
      if (isInsideAnyMenuSurface(event.target)) return;
      closeAndRestore();
    };
    window.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown);
    // Focus acquisition of a tall, scrollable menu can itself emit a delayed
    // scroll event. Arm viewport dismissal after that settling window so the
    // menu does not close immediately after keyboard opening.
    const scrollArmTimer = window.setTimeout(
      () => window.addEventListener('scroll', onViewportChange, true),
      500
    );
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onDocumentKeyDown);
      window.clearTimeout(scrollArmTimer);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [closeAndRestore]);

  const focusByOffset = (offset: number) => {
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(current + offset + buttons.length) % buttons.length]?.focus({ preventScroll: true });
  };

  const openSubmenuItem = openSubmenuId
    ? items.find((it) => it.id === openSubmenuId)
    : undefined;
  const openSubmenuAnchor = openSubmenuId ? submenuAnchors.current[openSubmenuId] : null;

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      className="fixed z-context-menu overflow-y-auto rounded-xl border border-c-border-subtle bg-c-surface py-1 shadow-xl"
      style={{ left: position.left, top: position.top, minWidth, maxHeight }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (openSubmenuId) setOpenSubmenuId(null);
          else closeAndRestore();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusByOffset(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusByOffset(-1);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)'
          );
          buttons?.[event.key === 'Home' ? 0 : buttons.length - 1]?.focus({ preventScroll: true });
        }
      }}
      data-testid={testId}
    >
      {header ? (
        <div className="border-b border-c-border-subtle px-2.5 py-1.5">{header}</div>
      ) : null}
      {items.map((item, index) => (
        <MenuRow
          key={item.id}
          item={item}
          index={index}
          items={items}
          submenuOpen={openSubmenuId === item.id}
          active={item.id === activeItemId}
          onTriggerSubmenu={(id, open) => setOpenSubmenuId(open ? id : null)}
          onSelectLeaf={handleSelectLeaf}
          onItemFocus={setActiveItemId}
          registerSubmenuAnchor={(id, el) => {
            submenuAnchors.current[id] = el;
          }}
        />
      ))}
    </div>
  );

  const target = portalTarget ?? document.body;

  return (
    <>
      {createPortal(menu, target)}
      {openSubmenuItem?.children && openSubmenuAnchor
        ? (
            <SubmenuFlyout
              anchorRect={openSubmenuAnchor.getBoundingClientRect()}
              items={openSubmenuItem.children}
              minWidth={Math.max(180, minWidth - 24)}
              portalTarget={target}
              onSelectLeaf={handleSelectLeaf}
              onRequestClose={() => {
                setOpenSubmenuId(null);
                openSubmenuAnchor.focus({ preventScroll: true });
              }}
            />
          )
        : null}
    </>
  );
};

export default CanvasContextMenu;
