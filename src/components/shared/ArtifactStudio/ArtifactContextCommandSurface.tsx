import React, { useEffect, useRef, useState } from 'react';

import type {
  ArtifactCommand,
  ArtifactCommandContext,
  ArtifactCommandRegistry,
} from './commands';
import { useArtifactCommands } from './commands';

export interface ArtifactContextCommandSurfaceProps {
  registry: ArtifactCommandRegistry;
  context: ArtifactCommandContext;
  resolveLabel: (labelKey: string, command: ArtifactCommand) => string;
  children: React.ReactNode;
  ariaLabel?: string;
  surfaceAriaLabel?: string;
  className?: string;
  onCommandError?: (command: ArtifactCommand, error: unknown) => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

export const ArtifactContextCommandSurface: React.FC<ArtifactContextCommandSurfaceProps> = ({
  registry,
  context,
  resolveLabel,
  children,
  ariaLabel = 'Menu kontekstowe',
  surfaceAriaLabel = 'Powierzchnia robocza',
  className,
  onCommandError,
}) => {
  const { visibleCommands, execute } = useArtifactCommands(registry, context, {
    alias: 'context-menu',
  });
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = (restoreFocus = true): void => {
    setPosition(null);
    if (restoreFocus) requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  const open = (x: number, y: number, target: EventTarget | null): void => {
    if (visibleCommands.length === 0) return;
    returnFocusRef.current = target instanceof HTMLElement ? target : surfaceRef.current;
    setPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - 248)),
      y: Math.max(8, Math.min(y, window.innerHeight - 80)),
    });
  };

  useEffect(() => {
    if (!position) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [position]);

  const run = (command: ArtifactCommand): void => {
    close(false);
    void execute(command.commandId).catch((error: unknown) => onCommandError?.(command, error));
  };

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      aria-label={surfaceAriaLabel}
      className={className}
      data-testid="artifact-context-command-surface"
      onContextMenu={(event) => {
        event.preventDefault();
        open(event.clientX, event.clientY, event.target);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const target = event.target instanceof HTMLElement ? event.target : surfaceRef.current;
          const rect = target?.getBoundingClientRect();
          open(rect?.left ?? 16, rect?.bottom ?? 16, target);
          return;
        }
        if (position && event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      {children}
      {position ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          data-testid="artifact-context-command-menu"
          className="fixed z-modal min-w-56 max-w-72 rounded-token-md border border-c-border-subtle bg-c-surface p-1 shadow-xl"
          style={{ left: position.x, top: position.y }}
          onKeyDown={(event) => {
            const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
            const current = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const delta = event.key === 'ArrowDown' ? 1 : -1;
              items[(current + delta + items.length) % items.length]?.focus();
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
            }
          }}
        >
          {visibleCommands.slice(0, 12).map(({ command, state }) => (
            <button
              key={command.commandId}
              type="button"
              role="menuitem"
              disabled={state.visibility === 'disabled'}
              aria-disabled={state.visibility === 'disabled' || undefined}
              data-command-id={command.commandId}
              onClick={() => run(command)}
              className="flex min-h-10 w-full items-center rounded-md px-3 py-2 text-left text-sm text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-45"
            >
              {resolveLabel(command.labelKey, command)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ArtifactContextCommandSurface;
