import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactCommand,
  type ArtifactCommandContext,
  ArtifactCommandRegistry,
} from '../commands';

const documentContext: ArtifactCommandContext = {
  selection: { artifactType: 'document', kind: 'text' },
  permissions: { grants: new Set(['edit']) },
  lifecycle: { status: 'draft' },
};

function command(
  commandId: string,
  overrides: Partial<ArtifactCommand> = {}
): ArtifactCommand {
  return {
    commandId,
    labelKey: commandId,
    artifactTypes: ['document'],
    category: 'editing',
    canonicalPlacement: 'menu3',
    aliases: ['context-menu'],
    priority: 'P0',
    implementation: 'available',
    auditClass: 'version',
    undoPolicy: 'undo',
    selectionPredicate: () => true,
    permissionPredicate: ({ grants }) => grants.has('edit'),
    lifecyclePredicate: ({ status }) => status === 'draft',
    execute: vi.fn(),
    ...overrides,
  };
}

describe('ArtifactCommandRegistry invariants', () => {
  it('rejects duplicate command ids without partially registering the batch', () => {
    const registry = new ArtifactCommandRegistry().register(command('doc.existing'));

    expect(() =>
      registry.registerMany([command('doc.new'), command('doc.existing')])
    ).toThrow('Duplicate artifact commandId: doc.existing');
    expect(registry.get('doc.new')).toBeUndefined();
    expect(registry.get('doc.existing')).toBeDefined();
  });

  it('rejects template commands and a fixed Teresa command in Menu 3', () => {
    expect(() =>
      new ArtifactCommandRegistry().register(command('doc.template.save'))
    ).toThrow('outside the open-artifact scope');
    expect(() =>
      new ArtifactCommandRegistry().register(
        command('doc.m3.teresa.open', { category: 'teresa' })
      )
    ).toThrow('cannot be fixed in Menu 3');
  });

  it('hides and refuses to execute a command owned by another artifact type', async () => {
    const execute = vi.fn();
    const registry = new ArtifactCommandRegistry().register(
      command('ppt.slide.duplicate', {
        artifactTypes: ['presentation'],
        execute,
      })
    );

    expect(registry.resolveState('ppt.slide.duplicate', documentContext)).toEqual({
      visibility: 'hidden',
      reason: 'artifact-type',
    });
    await expect(registry.execute('ppt.slide.duplicate', documentContext)).rejects.toThrow(
      'hidden: artifact-type'
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses one handler for canonical and aliased surfaces', async () => {
    const execute = vi.fn().mockResolvedValue('done');
    const registry = new ArtifactCommandRegistry().register(
      command('doc.text.bold', { execute })
    );

    expect(registry.query({ placement: 'menu3' })).toHaveLength(1);
    expect(registry.query({ alias: 'context-menu' })).toHaveLength(1);
    await expect(registry.execute('doc.text.bold', documentContext)).resolves.toBe('done');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('distinguishes selection, permission and lifecycle states', () => {
    const registry = new ArtifactCommandRegistry().register(
      command('doc.text.bold', {
        selectionPredicate: ({ kind }) => kind === 'text',
      })
    );

    expect(
      registry.resolveState('doc.text.bold', {
        ...documentContext,
        selection: { artifactType: 'document', kind: 'section' },
      })
    ).toEqual({ visibility: 'hidden', reason: 'selection' });
    expect(
      registry.resolveState('doc.text.bold', {
        ...documentContext,
        permissions: { grants: new Set() },
      })
    ).toEqual({ visibility: 'disabled', reason: 'permission' });
    expect(
      registry.resolveState('doc.text.bold', {
        ...documentContext,
        lifecycle: { status: 'final' },
      })
    ).toEqual({ visibility: 'disabled', reason: 'lifecycle' });
  });
});
