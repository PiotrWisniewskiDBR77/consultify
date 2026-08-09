import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ArtifactCommandRegistry,
  type ArtifactCommand,
  type ArtifactCommandContext,
  useArtifactCommands,
} from '@/components/shared/ArtifactStudio/commands';

const context: ArtifactCommandContext = {
  selection: { artifactType: 'document', kind: 'text' },
  permissions: { grants: new Set(['artifact.edit']) },
  lifecycle: { status: 'draft' },
};

function descriptor(
  commandId: string,
  artifactType: 'document' | 'presentation',
  implementation: 'available' | 'missing' = 'available'
): ArtifactCommand {
  return {
    commandId,
    labelKey: commandId,
    artifactTypes: [artifactType],
    category: 'editing',
    canonicalPlacement: 'menu3',
    aliases: [],
    priority: 'P0',
    implementation,
    auditClass: 'version',
    undoPolicy: 'undo',
    selectionPredicate: (selection) => selection.kind === 'text',
    permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
    lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft',
    execute: vi.fn(),
  };
}

describe('useArtifactCommands', () => {
  it('returns only implemented commands for the active artifact and selection', () => {
    const registry = new ArtifactCommandRegistry().registerMany([
      descriptor('doc.text.bold', 'document'),
      descriptor('doc.text.unimplemented', 'document', 'missing'),
      descriptor('ppt.text.bold', 'presentation'),
    ]);
    const { result } = renderHook(() => useArtifactCommands(registry, context));
    expect(result.current.visibleCommands.map(({ command }) => command.commandId)).toEqual([
      'doc.text.bold',
    ]);
  });

  it('routes UI execution back through the registry', async () => {
    const command = descriptor('doc.text.bold', 'document');
    const registry = new ArtifactCommandRegistry().register(command);
    const { result } = renderHook(() => useArtifactCommands(registry, context));
    await act(() => result.current.execute('doc.text.bold'));
    expect(command.execute).toHaveBeenCalledWith(context);
  });

  it('keeps Menu 2, Menu 3 and workflow commands on their canonical surfaces', () => {
    const menu3 = descriptor('doc.text.bold', 'document');
    const menu2 = descriptor('doc.export.open', 'document');
    menu2.canonicalPlacement = 'menu2';
    const workflow = descriptor('doc.qa.run', 'document');
    workflow.canonicalPlacement = 'workflow';
    const registry = new ArtifactCommandRegistry().registerMany([menu3, menu2, workflow]);

    const { result } = renderHook(() =>
      useArtifactCommands(registry, context, { placement: 'menu3' })
    );

    expect(result.current.visibleCommands.map(({ command }) => command.commandId)).toEqual([
      'doc.text.bold',
    ]);
  });
});
