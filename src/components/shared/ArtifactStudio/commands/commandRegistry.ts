import type {
  ArtifactCommand,
  ArtifactCommandContext,
  ArtifactCommandQuery,
  ArtifactCommandState,
} from './types';

const OPEN_ARTIFACT_TEMPLATE_PATTERN = /(^|\.)templates?(\.|$)/i;

function validateCommand(command: ArtifactCommand): void {
  if (!command.commandId.trim()) throw new Error('Artifact commandId is required');
  if (!command.labelKey.trim())
    throw new Error(`Artifact command ${command.commandId} requires labelKey`);
  if (command.artifactTypes.length === 0) {
    throw new Error(`Artifact command ${command.commandId} requires at least one artifact type`);
  }
  if (OPEN_ARTIFACT_TEMPLATE_PATTERN.test(command.commandId)) {
    throw new Error(`Template command ${command.commandId} is outside the open-artifact scope`);
  }
  if (command.category === 'teresa' && command.canonicalPlacement === 'menu3') {
    throw new Error(`Teresa command ${command.commandId} cannot be fixed in Menu 3`);
  }
}

export class ArtifactCommandRegistry {
  private readonly commands = new Map<string, ArtifactCommand>();

  register(command: ArtifactCommand): this {
    validateCommand(command);
    if (this.commands.has(command.commandId)) {
      throw new Error(`Duplicate artifact commandId: ${command.commandId}`);
    }
    this.commands.set(command.commandId, command);
    return this;
  }

  registerMany(commands: readonly ArtifactCommand[]): this {
    const incomingIds = new Set<string>();
    commands.forEach((command) => {
      validateCommand(command);
      if (incomingIds.has(command.commandId) || this.commands.has(command.commandId)) {
        throw new Error(`Duplicate artifact commandId: ${command.commandId}`);
      }
      incomingIds.add(command.commandId);
    });
    commands.forEach((command) => this.commands.set(command.commandId, command));
    return this;
  }

  get(commandId: string): ArtifactCommand | undefined {
    return this.commands.get(commandId);
  }

  list(): readonly ArtifactCommand[] {
    return [...this.commands.values()];
  }

  query(query: ArtifactCommandQuery = {}): readonly ArtifactCommand[] {
    return this.list().filter((command) => {
      if (query.placement && command.canonicalPlacement !== query.placement) return false;
      if (query.alias && !command.aliases.includes(query.alias)) return false;
      if (query.categories && !query.categories.includes(command.category)) return false;
      return true;
    });
  }

  resolveState(commandId: string, context: ArtifactCommandContext): ArtifactCommandState {
    const command = this.require(commandId);
    if (command.implementation === 'missing') {
      return { visibility: 'hidden', reason: 'not-implemented' };
    }
    if (!command.artifactTypes.includes(context.selection.artifactType)) {
      return { visibility: 'hidden', reason: 'artifact-type' };
    }
    if (!command.selectionPredicate(context.selection)) {
      return { visibility: 'hidden', reason: 'selection' };
    }
    if (!command.permissionPredicate(context.permissions)) {
      return { visibility: 'disabled', reason: 'permission' };
    }
    if (!command.lifecyclePredicate(context.lifecycle)) {
      return { visibility: 'disabled', reason: 'lifecycle' };
    }
    return { visibility: 'enabled' };
  }

  async execute<TResult = unknown>(
    commandId: string,
    context: ArtifactCommandContext
  ): Promise<TResult> {
    const command = this.require(commandId);
    const state = this.resolveState(commandId, context);
    if (state.visibility !== 'enabled') {
      throw new Error(`Artifact command ${commandId} is ${state.visibility}: ${state.reason}`);
    }
    return command.execute(context) as Promise<TResult> | TResult;
  }

  private require(commandId: string): ArtifactCommand {
    const command = this.commands.get(commandId);
    if (!command) throw new Error(`Unknown artifact commandId: ${commandId}`);
    return command;
  }
}
