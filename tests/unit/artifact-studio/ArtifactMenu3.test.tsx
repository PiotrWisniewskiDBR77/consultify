import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ArtifactCommandRegistry,
  ArtifactMenu3,
  type ArtifactCommand,
  type ArtifactCommandContext,
} from '@/components/shared/ArtifactStudio';

const context: ArtifactCommandContext = {
  selection: { artifactType: 'document', kind: 'text' },
  permissions: { grants: new Set(['artifact.edit']) },
  lifecycle: { status: 'draft' },
};

function command(commandId: string, overrides: Partial<ArtifactCommand> = {}): ArtifactCommand {
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
    permissionPredicate: ({ grants }) => grants.has('artifact.edit'),
    lifecyclePredicate: ({ status }) => status === 'draft',
    execute: vi.fn(),
    ...overrides,
  };
}

describe('ArtifactMenu3', () => {
  it('renders only implemented Menu 3 commands for the current selection', () => {
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold'),
      command('doc.text.future', { implementation: 'missing' }),
      command('doc.export.open', { canonicalPlacement: 'menu2' }),
    ]);

    render(<ArtifactMenu3 registry={registry} context={context} resolveLabel={(label) => label} />);

    expect(screen.getByRole('toolbar', { name: 'Narzędzia kontekstowe' })).toHaveAttribute(
      'data-selection-kind',
      'text'
    );
    expect(screen.getByRole('button', { name: 'doc.text.bold' })).toBeVisible();
    expect(screen.queryByText('doc.text.future')).not.toBeInTheDocument();
    expect(screen.queryByText('doc.export.open')).not.toBeInTheDocument();
  });

  it('routes execution through the registry and keeps permission failures disabled', async () => {
    const run = vi.fn();
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold', { execute: run }),
      command('doc.text.comment', {
        permissionPredicate: ({ grants }) => grants.has('artifact.comment'),
      }),
    ]);

    render(<ArtifactMenu3 registry={registry} context={context} resolveLabel={(label) => label} />);

    fireEvent.click(screen.getByRole('button', { name: 'doc.text.bold' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(context));
    expect(screen.getByRole('button', { name: 'doc.text.comment' })).toBeDisabled();
  });

  it('moves lower-priority commands into deterministic overflow', () => {
    const registry = new ArtifactCommandRegistry().registerMany([
      command('doc.text.bold'),
      command('doc.text.italic'),
      command('doc.text.underline'),
    ]);

    render(
      <ArtifactMenu3
        registry={registry}
        context={context}
        maxVisible={2}
        resolveLabel={(label) => label}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Więcej narzędzi' }));
    expect(screen.getByRole('menuitem', { name: 'doc.text.underline' })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
