import { describe, expect, it, vi } from 'vitest';

import type { ArtifactCommandContext } from '@/components/shared/ArtifactStudio';

import { createPresentationArtifactCommandRegistry } from '../presentationArtifactCommands';

const handlers = {
  undo: vi.fn(),
  redo: vi.fn(),
  addSlide: vi.fn(),
  duplicateSlide: vi.fn(),
  toggleSlideLock: vi.fn(),
  deleteSlide: vi.fn(),
  insertText: vi.fn(),
  insertImage: vi.fn(),
  openTheme: vi.fn(),
  duplicateBlock: vi.fn(),
  deleteBlock: vi.fn(),
};

const availability = {
  canUndo: true,
  canRedo: true,
  canDeleteSlide: true,
  hasActiveSlide: true,
  hasSelectedBlock: true,
};

function context(
  kind: ArtifactCommandContext['selection']['kind'],
  options: { canEdit?: boolean; conflict?: boolean } = {}
): ArtifactCommandContext {
  return {
    selection: { artifactType: 'presentation', kind },
    permissions: {
      grants: new Set(
        options.canEdit === false ? ['artifact.read'] : ['artifact.read', 'artifact.edit']
      ),
    },
    lifecycle: { status: 'draft', conflict: options.conflict },
  };
}

function visibleCommandIds(
  registry: ReturnType<typeof createPresentationArtifactCommandRegistry>,
  commandContext: ArtifactCommandContext
): string[] {
  return registry
    .query({ placement: 'menu3' })
    .filter(
      (command) => registry.resolveState(command.commandId, commandContext).visibility !== 'hidden'
    )
    .map((command) => command.commandId);
}

describe('presentation Artifact Studio commands', () => {
  it('exposes only real canvas commands for no selection', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    expect(visibleCommandIds(registry, context('none'))).toEqual([
      'ppt.edit.undo',
      'ppt.edit.redo',
      'ppt.slide.addAfter',
      'ppt.insert.text',
      'ppt.insert.image',
      'ppt.design.theme.open',
    ]);
  });

  it('switches to slide and block commands with the selection', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    expect(visibleCommandIds(registry, context('slide'))).toEqual([
      'ppt.edit.undo',
      'ppt.edit.redo',
      'ppt.slide.addAfter',
      'ppt.slide.duplicate',
      'ppt.slide.lock.toggle',
      'ppt.slide.delete',
    ]);
    expect(visibleCommandIds(registry, context('block'))).toEqual([
      'ppt.edit.undo',
      'ppt.edit.redo',
      'ppt.block.duplicate',
      'ppt.block.delete',
    ]);
  });

  it('hides delete slide when deleting would leave no slide', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, {
      ...availability,
      canDeleteSlide: false,
    });

    expect(visibleCommandIds(registry, context('slide'))).not.toContain('ppt.slide.delete');
  });

  it('disables mutations without edit permission or during a conflict', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    expect(
      registry.resolveState('ppt.slide.duplicate', context('slide', { canEdit: false }))
    ).toEqual({
      visibility: 'disabled',
      reason: 'permission',
    });
    expect(
      registry.resolveState('ppt.slide.duplicate', context('slide', { conflict: true }))
    ).toEqual({
      visibility: 'disabled',
      reason: 'lifecycle',
    });
  });

  it('uses the registered handler and never registers a fixed Teresa command', async () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    await registry.execute('ppt.block.duplicate', context('block'));

    expect(handlers.duplicateBlock).toHaveBeenCalledTimes(1);
    expect(registry.list().some((command) => command.category === 'teresa')).toBe(false);
  });
});
