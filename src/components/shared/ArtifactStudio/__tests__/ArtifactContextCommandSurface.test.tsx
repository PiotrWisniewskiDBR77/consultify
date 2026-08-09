import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactContextCommandSurface } from '../ArtifactContextCommandSurface';
import {
  type ArtifactCommand,
  type ArtifactCommandContext,
  ArtifactCommandRegistry,
} from '../commands';

const context: ArtifactCommandContext = {
  selection: { artifactType: 'document', kind: 'text' },
  permissions: { grants: new Set(['edit']) },
  lifecycle: { status: 'draft' },
};

function command(
  commandId: string,
  execute = vi.fn(),
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
    selectionPredicate: ({ kind }) => kind === 'text',
    permissionPredicate: ({ grants }) => grants.has('edit'),
    lifecyclePredicate: ({ status }) => status === 'draft',
    execute,
    ...overrides,
  };
}

describe('ArtifactContextCommandSurface', () => {
  it('opens on right click and executes the same registry command', async () => {
    const execute = vi.fn();
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold', execute),
      command('doc.text.no-context', vi.fn(), { aliases: [] }),
    ]);

    render(
      <ArtifactContextCommandSurface
        registry={registry}
        context={context}
        resolveLabel={(label) => label}
      >
        <button type="button">Canvas target</button>
      </ArtifactContextCommandSurface>
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Canvas target' }), {
      clientX: 80,
      clientY: 90,
    });
    expect(screen.getByRole('menu', { name: 'Menu kontekstowe' })).toBeInTheDocument();
    expect(screen.queryByText('doc.text.no-context')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'doc.text.bold' }));
    await waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('artifact-context-command-menu')).not.toBeInTheDocument();
  });

  it('supports Shift+F10, keyboard traversal, Escape and focus return', async () => {
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold'),
      command('doc.text.italic'),
    ]);

    render(
      <ArtifactContextCommandSurface
        registry={registry}
        context={context}
        resolveLabel={(label) => label}
      >
        <button type="button">Canvas target</button>
      </ArtifactContextCommandSurface>
    );

    const target = screen.getByRole('button', { name: 'Canvas target' });
    target.focus();
    fireEvent.keyDown(target, { key: 'F10', shiftKey: true });

    const first = await screen.findByRole('menuitem', { name: 'doc.text.bold' });
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'doc.text.italic' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(target).toHaveFocus());
    expect(screen.queryByTestId('artifact-context-command-menu')).not.toBeInTheDocument();
  });
});
