/**
 * Consultify Document Studio — Undo/Redo controls (P-11, 2026-07-28).
 *
 * The editor engine (TipTap's `@tiptap/starter-kit` bundles the `UndoRedo`
 * extension by default — see `getDocumentEditorExtensions.ts`, which never
 * sets `undoRedo: false`) already tracks history and answers Ctrl/Cmd+Z /
 * Ctrl/Cmd+Shift+Z. What was missing was a UI entry point — the classic
 * "silnik jest, nie da się kliknąć" pattern in this codebase. This component
 * is that entry point ONLY: a small, standalone pair of buttons that drive
 * `editor.commands.undo()/redo()` and reflect `editor.can().undo()/redo()`.
 *
 * Deliberately self-contained (props in, buttons out — no shell/toolbar
 * coupling) so it is trivial to relocate once the owner's redesigned right
 * panel lands (see `_HANDOFF_MATERIALY_KONTEKST_2026-07-28.md` — the top
 * bar is being slimmed down and functions are moving to the right panel,
 * but that panel's design isn't decided yet). Moving this later is a
 * one-line change: drop `<DocumentUndoRedoControls editor={editor} />`
 * into the new host and delete it from here.
 */

import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Redo2, Undo2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

export interface DocumentUndoRedoControlsProps {
  /** Live TipTap editor instance (from `DocumentTipTapEditor`'s `onEditorInstance`). `null` while the editor is mounting/unmounted. */
  editor: Editor | null;
  className?: string;
}

export const DocumentUndoRedoControls: React.FC<DocumentUndoRedoControlsProps> = ({
  editor,
  className,
}) => {
  const { t } = useTranslation();

  // `useEditorState` subscribes to the editor's `transaction` event so
  // `can().undo()/redo()` re-evaluates on every change (typing, external
  // schema sync, undo/redo itself) — a plain `editor?.can().undo()` read
  // here would only reflect the state at mount time.
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      canUndo: Boolean(ctx.editor?.can().undo()),
      canRedo: Boolean(ctx.editor?.can().redo()),
    }),
  });
  const canUndo = state?.canUndo ?? false;
  const canRedo = state?.canRedo ?? false;

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!editor || !canUndo}
        title={t('documentStudio.panel.undoTooltip', 'Cofnij ostatnią zmianę (Ctrl/Cmd+Z)')}
        aria-label={t('documentStudio.panel.undoLabel', 'Cofnij')}
        data-testid="document-studio-undo"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!editor || !canRedo}
        title={t('documentStudio.panel.redoTooltip', 'Ponów cofniętą zmianę (Ctrl/Cmd+Shift+Z)')}
        aria-label={t('documentStudio.panel.redoLabel', 'Ponów')}
        data-testid="document-studio-redo"
      >
        <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
};

export default DocumentUndoRedoControls;
