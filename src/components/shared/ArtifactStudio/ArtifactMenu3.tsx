import { ChevronDown, MoreHorizontal } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type {
  ArtifactCommand,
  ArtifactCommandContext,
  ArtifactCommandRegistry,
  ArtifactCommandState,
} from './commands';
import { useArtifactCommands } from './commands';

export interface ArtifactMenu3Props {
  registry: ArtifactCommandRegistry;
  context: ArtifactCommandContext;
  /** i18n stays in the adapter; the shared shell only resolves stable keys. */
  resolveLabel: (labelKey: string, command: ArtifactCommand) => string;
  /** Deterministic responsive budget. P0 commands consume the budget first. */
  maxVisible?: number;
  ariaLabel?: string;
  className?: string;
  onCommandError?: (command: ArtifactCommand, error: unknown) => void;
}

interface CommandButtonProps {
  command: ArtifactCommand;
  state: ArtifactCommandState;
  label: string;
  menuItem?: boolean;
  onExecute: () => void;
}

const CommandButton: React.FC<CommandButtonProps> = ({
  command,
  state,
  label,
  menuItem = false,
  onExecute,
}) => {
  const disabled = state.visibility === 'disabled';
  const disabledReason = disabled
    ? state.reason === 'permission'
      ? 'Brak uprawnień'
      : 'Niedostępne w bieżącym stanie dokumentu'
    : undefined;

  return (
    <button
      type="button"
      role={menuItem ? 'menuitem' : undefined}
      onClick={disabled ? undefined : onExecute}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabledReason ?? label}
      data-command-id={command.commandId}
      data-command-state={state.visibility}
      className={
        menuItem
          ? 'flex min-h-10 w-full items-center rounded-md px-3 py-2 text-left text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45'
          : 'inline-flex min-h-10 flex-shrink-0 items-center rounded-lg px-3 text-sm font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text disabled:cursor-not-allowed disabled:opacity-45'
      }
    >
      <span className="truncate">{label}</span>
    </button>
  );
};

export const ArtifactMenu3: React.FC<ArtifactMenu3Props> = ({
  registry,
  context,
  resolveLabel,
  maxVisible = 7,
  ariaLabel = 'Narzędzia kontekstowe',
  className,
  onCommandError,
}) => {
  const { visibleCommands, execute } = useArtifactCommands(registry, context, {
    placement: 'menu3',
  });
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  const [direct, overflow] = useMemo(() => {
    const safeLimit = Math.max(1, maxVisible);
    return [visibleCommands.slice(0, safeLimit), visibleCommands.slice(safeLimit)];
  }, [maxVisible, visibleCommands]);

  useEffect(() => {
    if (!overflowOpen) return;
    const closeOutside = (event: MouseEvent): void => {
      if (!overflowRef.current?.contains(event.target as Node)) setOverflowOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOverflowOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [overflowOpen]);

  const run = (command: ArtifactCommand): void => {
    void execute(command.commandId).catch((error: unknown) => onCommandError?.(command, error));
  };

  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      data-testid="artifact-menu3"
      data-selection-kind={context.selection.kind}
      className={`flex h-12 flex-shrink-0 items-center gap-1 overflow-visible border-b border-c-border-subtle bg-c-surface px-3 ${className ?? ''}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {direct.map(({ command, state }) => (
          <CommandButton
            key={command.commandId}
            command={command}
            state={state}
            label={resolveLabel(command.labelKey, command)}
            onExecute={() => run(command)}
          />
        ))}
      </div>

      {overflow.length > 0 ? (
        <div className="relative flex-shrink-0" ref={overflowRef}>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
            onClick={() => setOverflowOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-label="Więcej narzędzi"
            data-testid="artifact-menu3-overflow"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
            <span>Więcej</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {overflowOpen ? (
            <div
              role="menu"
              aria-label="Więcej narzędzi"
              className="absolute right-0 top-full z-dropdown mt-1 min-w-56 rounded-token-md border border-c-border-subtle bg-c-surface p-1 shadow-lg"
              data-testid="artifact-menu3-overflow-menu"
            >
              {overflow.map(({ command, state }) => (
                <CommandButton
                  key={command.commandId}
                  command={command}
                  state={state}
                  label={resolveLabel(command.labelKey, command)}
                  menuItem
                  onExecute={() => {
                    setOverflowOpen(false);
                    run(command);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ArtifactMenu3;
