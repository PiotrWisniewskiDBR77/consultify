/**
 * Document Studio — in-place block editor (R1 / E1 + E2).
 *
 * Replaces the read-only `renderSectionPreview` with a single TipTap document
 * editor over the whole `DocumentSchema`. The schema is converted to a
 * ProseMirror doc on load (`schemaToProseMirror`) and converted back on edit
 * (`proseMirrorToSchema`) with ZERO loss of identity (blockId / sourceRef /
 * isAssumption / sectionId).
 *
 * REMOUNT-ON-EDIT GUARD ([[finding_ideas_canvas_remount_on_edit]]):
 * the editor instance is created ONCE per `artifactId`. We never key the
 * component (or `useEditor`) on the mutable schema, and external schema syncs
 * go through `setContent({ emitUpdate:false })` instead of remounting — so the
 * cursor / selection / undo stack survive every keystroke.
 *
 * E3 AUTOSAVE is intentionally OUT OF SCOPE here: `onSchemaUpdated` fires the
 * reconstructed schema (debounced), but persistence (PUT path / optimistic
 * lock) is a separate backend decision and is wired by Claude later.
 */

import { EditorContent, useEditor } from '@tiptap/react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { DocumentInlineAIMenu } from '../inline-ai';
import { getDocumentEditorExtensions } from './documentEditorExtensions';
import { proseMirrorToSchema, type PMDoc } from './tipTapToSchema';
import { schemaToProseMirror } from './schemaToTipTap';
import type { DocumentSchema } from '../types';

const SAVE_DEBOUNCE_MS = 300;

export interface DocumentTipTapEditorProps {
  schema: DocumentSchema;
  onSchemaUpdated?: (next: DocumentSchema) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** When provided, enables the inline-AI floating menu (R2). */
  artifactId?: string;
}

export const DocumentTipTapEditor: React.FC<DocumentTipTapEditorProps> = ({
  schema,
  onSchemaUpdated,
  editable = true,
  placeholder,
  className,
  artifactId,
}) => {
  const extensions = useMemo(() => getDocumentEditorExtensions(placeholder), [placeholder]);

  // Always read the freshest schema + callback from refs so the (stable) editor
  // callbacks never close over a stale render.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const onSchemaUpdatedRef = useRef(onSchemaUpdated);
  onSchemaUpdatedRef.current = onSchemaUpdated;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdateRef = useRef(false);

  // Initial PM doc — computed once; subsequent schema changes flow through the
  // sync effect below, NOT through a remount.
  const initialDoc = useMemo(() => schemaToProseMirror(schema), [schema.artifactId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor(
    {
      extensions,
      editable,
      content: initialDoc as unknown as Record<string, unknown>,
      onUpdate: ({ editor: ed }) => {
        if (isExternalUpdateRef.current) return;
        if (!onSchemaUpdatedRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const json = ed.getJSON() as unknown as PMDoc;
          const next = proseMirrorToSchema(json, schemaRef.current);
          onSchemaUpdatedRef.current?.(next);
        }, SAVE_DEBOUNCE_MS);
      },
    },
    // Re-create the editor ONLY when the document identity changes — never on a
    // content edit. This is the remount-on-edit guard.
    [schema.artifactId]
  );

  // Keep editable in sync without remounting.
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  // External schema replacement (e.g. an applied AI proposal from the right
  // rail) → push the new doc into the LIVE editor without re-mounting and
  // without echoing back through onUpdate.
  const lastArtifactRef = useRef(schema.artifactId);
  const syncSchema = useCallback(
    (next: DocumentSchema) => {
      if (!editor) return;
      isExternalUpdateRef.current = true;
      const doc = schemaToProseMirror(next);
      editor.commands.setContent(doc as unknown as Record<string, unknown>, { emitUpdate: false });
      isExternalUpdateRef.current = false;
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    // A new artifact remounts the editor (initialDoc handles it); only sync
    // in-place for same-artifact schema swaps.
    if (schema.artifactId !== lastArtifactRef.current) {
      lastArtifactRef.current = schema.artifactId;
      return;
    }
    // Heuristic: only force a sync when the incoming schema did NOT originate
    // from our own debounced onUpdate. We detect that by comparing the
    // serialized current editor doc to the incoming schema's PM projection.
    try {
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(schemaToProseMirror(schema));
      if (current !== incoming) syncSchema(schema);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className={className} data-testid="document-tiptap-editor">
      <EditorContent
        editor={editor}
        className="document-studio-editor prose prose-slate max-w-none dark:prose-invert"
      />
      {artifactId && (
        <DocumentInlineAIMenu
          editor={editor ?? null}
          artifactId={artifactId}
          onSchemaUpdated={onSchemaUpdated}
        />
      )}
    </div>
  );
};

export default DocumentTipTapEditor;
