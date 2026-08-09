import { describe, expect, it, vi } from 'vitest';
import {
  ArtifactCommandRegistry,
  type ArtifactCommand,
  type ArtifactCommandContext,
} from '@/components/shared/ArtifactStudio/commands';

const context: ArtifactCommandContext = {
  selection: { artifactType: 'document', kind: 'text' },
  permissions: { grants: new Set(['artifact.edit']) },
  lifecycle: { status: 'draft' },
};

function command(overrides: Partial<ArtifactCommand> = {}): ArtifactCommand {
  return {
    commandId: 'doc.text.bold',
    labelKey: 'artifact.commands.bold',
    artifactTypes: ['document'],
    category: 'editing',
    canonicalPlacement: 'menu3',
    aliases: ['keyboard', 'context-menu'],
    priority: 'P0',
    implementation: 'available',
    auditClass: 'version',
    undoPolicy: 'undo',
    selectionPredicate: (selection) => selection.kind === 'text',
    permissionPredicate: (permissions) => permissions.grants.has('artifact.edit'),
    lifecyclePredicate: (lifecycle) => lifecycle.status === 'draft',
    execute: vi.fn(() => 'done'),
    ...overrides,
  };
}

describe('ArtifactCommandRegistry', () => {
  it('rejects duplicate command IDs', () => {
    const registry = new ArtifactCommandRegistry().register(command());
    expect(() => registry.register(command())).toThrow('Duplicate artifact commandId');
  });

  it('keeps missing capabilities hidden', () => {
    const registry = new ArtifactCommandRegistry().register(command({ implementation: 'missing' }));
    expect(registry.resolveState('doc.text.bold', context)).toEqual({
      visibility: 'hidden',
      reason: 'not-implemented',
    });
  });

  it('separates selection, permission and lifecycle decisions', () => {
    const registry = new ArtifactCommandRegistry().register(command());
    expect(registry.resolveState('doc.text.bold', context)).toEqual({ visibility: 'enabled' });
    expect(registry.resolveState('doc.text.bold', {
      ...context,
      selection: { artifactType: 'document', kind: 'section' },
    })).toEqual({ visibility: 'hidden', reason: 'selection' });
    expect(registry.resolveState('doc.text.bold', {
      ...context,
      permissions: { grants: new Set() },
    })).toEqual({ visibility: 'disabled', reason: 'permission' });
    expect(registry.resolveState('doc.text.bold', {
      ...context,
      lifecycle: { status: 'final' },
    })).toEqual({ visibility: 'disabled', reason: 'lifecycle' });
  });

  it('executes the single registered handler for every alias surface', async () => {
    const execute = vi.fn(() => 'done');
    const registry = new ArtifactCommandRegistry().register(command({ execute }));
    await expect(registry.execute('doc.text.bold', context)).resolves.toBe('done');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('forbids template commands in an open artifact and fixed Teresa in Menu 3', () => {
    expect(() => new ArtifactCommandRegistry().register(command({
      commandId: 'doc.template.save',
    }))).toThrow('outside the open-artifact scope');
    expect(() => new ArtifactCommandRegistry().register(command({
      commandId: 'doc.teresa.open',
      category: 'teresa',
      canonicalPlacement: 'menu3',
    }))).toThrow('cannot be fixed in Menu 3');
  });

  it('allows Teresa only as a global bottom or contextual handoff command', () => {
    expect(() => new ArtifactCommandRegistry().register(command({
      commandId: 'doc.context.sendToTeresa',
      category: 'teresa',
      canonicalPlacement: 'context-menu',
    }))).not.toThrow();
  });
});
