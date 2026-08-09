import type {
  ArtifactCommand,
  ArtifactPermissionContext,
  ArtifactSelectionContext,
} from '@/components/shared/ArtifactStudio';
import { ArtifactCommandRegistry } from '@/components/shared/ArtifactStudio';

export interface DocumentArtifactCommandHandlers {
  undo: () => void;
  redo: () => void;
  setParagraph: () => void;
  setHeading: (level: 1 | 2 | 3) => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
}

export interface DocumentArtifactCommandAvailability {
  canUndo: boolean;
  canRedo: boolean;
  editorReady: boolean;
}

const canEdit = ({ grants }: ArtifactPermissionContext): boolean => grants.has('artifact.edit');
const mutableLifecycle = (lifecycle: { status: string; conflict?: boolean }): boolean =>
  !lifecycle.conflict && (lifecycle.status === 'draft' || lifecycle.status === 'in_review');
const editable = (selection: ArtifactSelectionContext): boolean => !selection.readOnly;

export function createDocumentArtifactCommandRegistry(
  handlers: DocumentArtifactCommandHandlers,
  availability: DocumentArtifactCommandAvailability
): ArtifactCommandRegistry {
  const editCommand = (
    definition: Pick<
      ArtifactCommand,
      'commandId' | 'labelKey' | 'priority' | 'selectionPredicate' | 'execute'
    >
  ): ArtifactCommand => ({
    artifactTypes: ['document'],
    canonicalPlacement: 'menu3',
    aliases: ['keyboard', 'context-menu'],
    implementation: 'available',
    category: 'editing',
    auditClass: 'version',
    undoPolicy: 'undo',
    permissionPredicate: canEdit,
    lifecyclePredicate: mutableLifecycle,
    ...definition,
  });

  return new ArtifactCommandRegistry().registerMany([
    editCommand({
      commandId: 'doc.edit.undo',
      labelKey: 'Cofnij',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && availability.canUndo,
      execute: handlers.undo,
    }),
    editCommand({
      commandId: 'doc.edit.redo',
      labelKey: 'Ponów',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && availability.canRedo,
      execute: handlers.redo,
    }),
    editCommand({
      commandId: 'doc.style.paragraph',
      labelKey: 'Tekst',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && availability.editorReady && selection.kind !== 'section',
      execute: handlers.setParagraph,
    }),
    ...([1, 2, 3] as const).map((level) =>
      editCommand({
        commandId: `doc.style.heading${level}`,
        labelKey: `H${level}`,
        priority: 'P0',
        selectionPredicate: (selection) =>
          editable(selection) && availability.editorReady && selection.kind !== 'section',
        execute: () => handlers.setHeading(level),
      })
    ),
    editCommand({
      commandId: 'doc.text.bold',
      labelKey: 'Pogrubienie',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && availability.editorReady && selection.kind === 'text',
      execute: handlers.toggleBold,
    }),
    editCommand({
      commandId: 'doc.text.italic',
      labelKey: 'Kursywa',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && availability.editorReady && selection.kind === 'text',
      execute: handlers.toggleItalic,
    }),
    editCommand({
      commandId: 'doc.text.underline',
      labelKey: 'Podkreślenie',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && availability.editorReady && selection.kind === 'text',
      execute: handlers.toggleUnderline,
    }),
    editCommand({
      commandId: 'doc.text.listBullet',
      labelKey: 'Lista',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && availability.editorReady,
      execute: handlers.toggleBulletList,
    }),
    editCommand({
      commandId: 'doc.text.listNumbered',
      labelKey: 'Lista numerowana',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && availability.editorReady,
      execute: handlers.toggleOrderedList,
    }),
  ]);
}
