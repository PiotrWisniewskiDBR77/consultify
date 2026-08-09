import type {
  ArtifactCommand,
  ArtifactPermissionContext,
  ArtifactSelectionContext,
} from '@/components/shared/ArtifactStudio';
import { ArtifactCommandRegistry } from '@/components/shared/ArtifactStudio';

export interface PresentationArtifactCommandHandlers {
  undo: () => void;
  redo: () => void;
  addSlide: () => void;
  duplicateSlide: () => void;
  toggleSlideLock: () => void;
  deleteSlide: () => void;
  insertText: () => void;
  insertImage: () => void;
  openTheme: () => void;
  duplicateBlock: () => void;
  deleteBlock: () => void;
}

interface PresentationArtifactCommandAvailability {
  canUndo: boolean;
  canRedo: boolean;
  canDeleteSlide: boolean;
  hasActiveSlide: boolean;
  hasSelectedBlock: boolean;
}

const editable = (selection: ArtifactSelectionContext): boolean => !selection.readOnly;
const selectionIs =
  (...kinds: ArtifactSelectionContext['kind'][]) =>
  (selection: ArtifactSelectionContext): boolean =>
    kinds.includes(selection.kind);
const canEdit = ({ grants }: ArtifactPermissionContext): boolean => grants.has('artifact.edit');
const mutableLifecycle = (lifecycle: { status: string; conflict?: boolean }): boolean =>
  !lifecycle.conflict && (lifecycle.status === 'draft' || lifecycle.status === 'in_review');

export function createPresentationArtifactCommandRegistry(
  handlers: PresentationArtifactCommandHandlers,
  availability: PresentationArtifactCommandAvailability
): ArtifactCommandRegistry {
  const command = (
    definition: Pick<
      ArtifactCommand,
      'commandId' | 'labelKey' | 'category' | 'priority' | 'selectionPredicate' | 'execute'
    >
  ): ArtifactCommand => ({
    artifactTypes: ['presentation'],
    canonicalPlacement: 'menu3',
    aliases: ['keyboard', 'context-menu'],
    implementation: 'available',
    auditClass: definition.category === 'view' ? 'none' : 'version',
    undoPolicy: definition.category === 'view' ? 'view-toggle' : 'undo',
    permissionPredicate: canEdit,
    lifecyclePredicate: mutableLifecycle,
    ...definition,
  });

  return new ArtifactCommandRegistry().registerMany([
    command({
      commandId: 'ppt.edit.undo',
      labelKey: 'Cofnij',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && availability.canUndo,
      execute: handlers.undo,
    }),
    command({
      commandId: 'ppt.edit.redo',
      labelKey: 'Ponów',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && availability.canRedo,
      execute: handlers.redo,
    }),
    command({
      commandId: 'ppt.slide.addAfter',
      labelKey: 'Nowy slajd',
      category: 'structure',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && selectionIs('none', 'slide')(selection),
      execute: handlers.addSlide,
    }),
    command({
      commandId: 'ppt.insert.text',
      labelKey: 'Pole tekstowe',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && selection.kind === 'none' && availability.hasActiveSlide,
      execute: handlers.insertText,
    }),
    command({
      commandId: 'ppt.insert.image',
      labelKey: 'Obraz',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && selection.kind === 'none' && availability.hasActiveSlide,
      execute: handlers.insertImage,
    }),
    command({
      commandId: 'ppt.design.theme.open',
      labelKey: 'Motyw',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && selection.kind === 'none',
      execute: handlers.openTheme,
    }),
    command({
      commandId: 'ppt.slide.duplicate',
      labelKey: 'Duplikuj slajd',
      category: 'structure',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && selection.kind === 'slide',
      execute: handlers.duplicateSlide,
    }),
    command({
      commandId: 'ppt.slide.lock.toggle',
      labelKey: 'Zablokuj / odblokuj',
      category: 'structure',
      priority: 'P0',
      selectionPredicate: (selection) => editable(selection) && selection.kind === 'slide',
      execute: handlers.toggleSlideLock,
    }),
    command({
      commandId: 'ppt.slide.delete',
      labelKey: 'Usuń slajd',
      category: 'structure',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && selection.kind === 'slide' && availability.canDeleteSlide,
      execute: handlers.deleteSlide,
    }),
    command({
      commandId: 'ppt.block.duplicate',
      labelKey: 'Duplikuj obiekt',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && selection.kind === 'block' && availability.hasSelectedBlock,
      execute: handlers.duplicateBlock,
    }),
    command({
      commandId: 'ppt.block.delete',
      labelKey: 'Usuń obiekt',
      category: 'editing',
      priority: 'P0',
      selectionPredicate: (selection) =>
        editable(selection) && selection.kind === 'block' && availability.hasSelectedBlock,
      execute: handlers.deleteBlock,
    }),
  ]);
}
