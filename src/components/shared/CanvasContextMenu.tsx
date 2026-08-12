import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const firstEnabledIndex = items.findIndex((item) => !item.disabled);

  const closeAndRestore = React.useCallback(() => {
    onClose();
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const canvasRect = document
      .querySelector<HTMLElement>('[data-testid="mels-canvas"]')
      ?.getBoundingClientRect();
    const bounds = canvasRect ?? {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
    };
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
    const firstEnabledItem = menu.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)'
    );
    firstEnabledItem?.focus({ preventScroll: true });

    // Portals and the browser's native Shift+F10 processing may both finish
    // after this layout effect. Reassert initial focus once on the next frame,
    // but only while focus is still outside this menu; never override keyboard
    // navigation the user has already started inside it.
    const focusFrame = requestAnimationFrame(() => {
      if (!menu.contains(document.activeElement)) {
        firstEnabledItem?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(focusFrame);
  }, [firstEnabledIndex, items.length, x, y]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeAndRestore();
    };
    const onViewportChange = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      closeAndRestore();
    };
    window.addEventListener('mousedown', onPointerDown, true);
    // Focus acquisition of a tall, scrollable menu can itself emit a delayed
    // scroll event. Arm viewport dismissal after that settling window so the
    // menu does not close immediately after keyboard opening.
    const scrollArmTimer = window.setTimeout(
      () => window.addEventListener('scroll', onViewportChange, true),
      500
    );
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
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

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      className="fixed z-context-menu overflow-y-auto rounded-xl border border-c-border-subtle bg-c-surface py-1 shadow-xl"
      style={{ left: position.left, top: position.top, minWidth, maxHeight }}
      data-testid={testId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeAndRestore();
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
    >
      {header ? (
        <div className="border-b border-c-border-subtle px-2.5 py-1.5">{header}</div>
      ) : null}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {item.groupLabel && item.groupLabel !== items[index - 1]?.groupLabel ? (
            <div className="px-2.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-c-text-muted">
              {item.groupLabel}
            </div>
          ) : null}
          {item.separatorBefore ? (
            <div role="separator" className="mx-2 my-0.5 border-t border-c-border-subtle" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            autoFocus={index === firstEnabledIndex}
            disabled={item.disabled}
            aria-disabled={item.disabled || undefined}
            title={
              item.disabled && item.disabledReason
                ? `${item.label} — ${item.disabledReason}`
                : item.label
            }
            onClick={() => {
              if (item.disabled) return;
              item.onSelect();
              if (item.closeOnSelect !== false) closeAndRestore();
            }}
            className={`flex min-h-11 w-full items-center gap-2 px-2.5 text-left text-[13px] leading-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              item.danger
                ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20'
                : 'text-c-text hover:bg-c-surface-raised'
            }`}
            data-command-id={item.id}
          >
            {item.icon ? (
              <span className="shrink-0" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">{item.label}</span>
            {item.shortcut ? (
              <kbd className="ml-2 text-[9px] text-c-text-muted">{item.shortcut}</kbd>
            ) : null}
          </button>
          {item.separatorAfter ? (
            <div role="separator" className="mx-2 my-0.5 border-t border-c-border-subtle" />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );

  return createPortal(menu, portalTarget ?? document.body);
};

export default CanvasContextMenu;
