import { describe, expect, it, vi } from 'vitest';

import type { ArtifactCommandContext } from '@/components/shared/ArtifactStudio';

import { createDocumentArtifactCommandRegistry } from '../documentArtifactCommands';

const handlers = {
  undo: vi.fn(),
  redo: vi.fn(),
  setParagraph: vi.fn(),
  setHeading: vi.fn(),
  toggleBulletList: vi.fn(),
  toggleOrderedList: vi.fn(),
  toggleBold: vi.fn(),
  toggleItalic: vi.fn(),
  toggleUnderline: vi.fn(),
};

const availability = { canUndo: true, canRedo: true, editorReady: true };

function context(
  kind: ArtifactCommandContext['selection']['kind'],
  options: { canEdit?: boolean; conflict?: boolean; readOnly?: boolean } = {}
): ArtifactCommandContext {
  return {
    selection: { artifactType: 'document', kind, readOnly: options.readOnly },
    permissions: {
      grants: new Set(
        options.canEdit === false ? ['artifact.read'] : ['artifact.read', 'artifact.edit']
      ),
    },
    lifecycle: { status: 'draft', conflict: options.conflict },
  };
}

function visible(kind: ArtifactCommandContext['selection']['kind']): string[] {
  const registry = createDocumentArtifactCommandRegistry(handlers, availability);
  const commandContext = context(kind);
  return registry
    .query({ placement: 'menu3' })
    .filter(
      (command) => registry.resolveState(command.commandId, commandContext).visibility !== 'hidden'
    )
    .map((command) => command.commandId);
}

describe('document Artifact Studio commands', () => {
  it('shows paragraph controls for a caret and text formatting for a text selection', () => {
    expect(visible('none')).toEqual([
      'doc.edit.undo',
      'doc.edit.redo',
      'doc.style.paragraph',
      'doc.style.heading1',
      'doc.style.heading2',
      'doc.style.heading3',
      'doc.text.listBullet',
      'doc.text.listNumbered',
    ]);
    expect(visible('text')).toEqual([
      'doc.edit.undo',
      'doc.edit.redo',
      'doc.style.paragraph',
      'doc.style.heading1',
      'doc.style.heading2',
      'doc.style.heading3',
      'doc.text.bold',
      'doc.text.italic',
      'doc.text.underline',
      'doc.text.listBullet',
      'doc.text.listNumbered',
    ]);
  });

  it('disables mutations without edit permission, in read-only mode, or on conflict', () => {
    const registry = createDocumentArtifactCommandRegistry(handlers, availability);

    expect(registry.resolveState('doc.text.bold', context('text', { canEdit: false }))).toEqual({
      visibility: 'disabled',
      reason: 'permission',
    });
    expect(registry.resolveState('doc.text.bold', context('text', { readOnly: true }))).toEqual({
      visibility: 'hidden',
      reason: 'selection',
    });
    expect(registry.resolveState('doc.text.bold', context('text', { conflict: true }))).toEqual({
      visibility: 'disabled',
      reason: 'lifecycle',
    });
  });

  it('executes the real handler and has no fixed Teresa command', async () => {
    const registry = createDocumentArtifactCommandRegistry(handlers, availability);

    await registry.execute('doc.text.bold', context('text'));

    expect(handlers.toggleBold).toHaveBeenCalledTimes(1);
    expect(registry.list().some((command) => command.category === 'teresa')).toBe(false);
  });
});
