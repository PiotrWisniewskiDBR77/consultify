import { useCallback, useMemo } from 'react';

import type { ArtifactCommandRegistry } from './commandRegistry';
import type {
  ArtifactCommand,
  ArtifactCommandContext,
  ArtifactCommandQuery,
  ArtifactCommandState,
} from './types';

export interface ResolvedArtifactCommand {
  command: ArtifactCommand;
  state: ArtifactCommandState;
}

export interface UseArtifactCommandsResult {
  visibleCommands: readonly ResolvedArtifactCommand[];
  execute: (commandId: string) => Promise<unknown>;
}

export function useArtifactCommands(
  registry: ArtifactCommandRegistry,
  context: ArtifactCommandContext,
  query: ArtifactCommandQuery = {}
): UseArtifactCommandsResult {
  const categoryKey = query.categories?.join('|') ?? '';
  const visibleCommands = useMemo(
    () =>
      registry
        .query(query)
        .filter((command) => command.artifactTypes.includes(context.selection.artifactType))
        .map((command) => ({ command, state: registry.resolveState(command.commandId, context) }))
        .filter((resolved) => resolved.state.visibility !== 'hidden')
        .sort((left, right) => left.command.priority.localeCompare(right.command.priority)),
    // `categories` is semantically a value list. categoryKey avoids forcing
    // callers to memoise a short literal array merely to keep this stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryKey, context, query.alias, query.placement, registry]
  );

  const execute = useCallback(
    (commandId: string) => registry.execute(commandId, context),
    [context, registry]
  );

  return { visibleCommands, execute };
}
