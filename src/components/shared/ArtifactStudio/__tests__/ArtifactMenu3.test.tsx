import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactMenu3 } from '../ArtifactMenu3';
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

const command = (
  commandId: string,
  execute = vi.fn(),
  overrides: Partial<ArtifactCommand> = {}
): ArtifactCommand => ({
  commandId,
  labelKey: commandId,
  artifactTypes: ['document'],
  category: 'editing',
  canonicalPlacement: 'menu3',
  aliases: [],
  priority: 'P0',
  implementation: 'available',
  auditClass: 'version',
  undoPolicy: 'undo',
  selectionPredicate: ({ kind }) => kind === 'text',
  permissionPredicate: ({ grants }) => grants.has('edit'),
  lifecyclePredicate: ({ status }) => status === 'draft',
  execute,
  ...overrides,
});

describe('ArtifactMenu3', () => {
  it('renders only real commands matching the current selection', () => {
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold'),
      command('doc.text.missing', vi.fn(), { implementation: 'missing' }),
      command('doc.section.rename', vi.fn(), {
        selectionPredicate: ({ kind }) => kind === 'section',
      }),
    ]);

    render(<ArtifactMenu3 registry={registry} context={context} resolveLabel={(label) => label} />);

    expect(screen.getByRole('button', { name: 'doc.text.bold' })).toBeInTheDocument();
    expect(screen.queryByText('doc.text.missing')).not.toBeInTheDocument();
    expect(screen.queryByText('doc.section.rename')).not.toBeInTheDocument();
    expect(screen.getByTestId('artifact-menu3')).toHaveAttribute('data-selection-kind', 'text');
  });

  it('executes direct and overflow commands through the registry', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold', first),
      command('doc.text.italic', second),
    ]);

    render(
      <ArtifactMenu3
        registry={registry}
        context={context}
        resolveLabel={(label) => label}
        maxVisible={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'doc.text.bold' }));
    fireEvent.click(screen.getByTestId('artifact-menu3-overflow'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'doc.text.italic' }));

    await waitFor(() => {
      expect(first).toHaveBeenCalledOnce();
      expect(second).toHaveBeenCalledOnce();
    });
    expect(screen.queryByTestId('artifact-menu3-overflow-menu')).not.toBeInTheDocument();
  });

  it('explains disabled commands and closes overflow with Escape', () => {
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold'),
      command('doc.text.italic', vi.fn(), {
        permissionPredicate: () => false,
      }),
    ]);

    render(
      <ArtifactMenu3
        registry={registry}
        context={context}
        resolveLabel={(label) => label}
        maxVisible={1}
      />
    );

    fireEvent.click(screen.getByTestId('artifact-menu3-overflow'));
    const disabled = screen.getByRole('menuitem', { name: 'doc.text.italic' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute('title', 'Brak uprawnień');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('artifact-menu3-overflow-menu')).not.toBeInTheDocument();
  });
});
