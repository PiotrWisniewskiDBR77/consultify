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
 * E3 AUTOSAVE (P0 data-loss fix): a manual edit used to only update the
 * parent's in-memory `schema` state (`onSchemaUpdated`) — nothing reached
 * the server, so a reload silently discarded it (or reverted to whatever an
 * AI proposal had last approved). We now debounce the reconstructed schema
 * and PUT its `sections` to `PUT /api/document-studio/:artifactId/content`
 * (`saveDocumentStudioManualContent`), the same durable overlay layer the
 * AI-proposal / rollback / content-block-insert paths already write
 * through server-side. An optimistic-lock `expectedVersion` (mirrors
 * `PUT /api/v8/notebook/pages/:noteId/content`) guards against clobbering
 * a newer server state (e.g. an approved proposal, or another tab's
 * autosave); a 409 is resolved by re-fetching the artifact rather than
 * force-pushing the local buffer, so this path can never race the
 * approve-flow's own writes.
 */

import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  DocumentManualSaveConflictError,
  getDocumentStudioArtifact,
  saveDocumentStudioManualContent,
} from '../api';
import { DocumentInlineAIMenu } from '../inline-ai';
import type { DocumentSchema } from '../types';
import { getDocumentEditorExtensions } from './documentEditorExtensions';
import { DOC_IMAGE_NODE_NAME, KPI_STRIP_NODE_NAME } from './nodeNames';
import { schemaToProseMirror } from './schemaToTipTap';
import { type PMDoc, proseMirrorToSchema } from './tipTapToSchema';

const SAVE_DEBOUNCE_MS = 500;

export type DocumentAutosaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface DocumentTipTapEditorProps {
  schema: DocumentSchema;
  onSchemaUpdated?: (next: DocumentSchema) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** When provided, enables the inline-AI floating menu (R2) AND manual-edit autosave. */
  artifactId?: string;
  /** Optional autosave status observer (idle/saving/saved/conflict/error) for UI feedback. */
  onAutosaveStatusChange?: (status: DocumentAutosaveStatus) => void;
  /**
   * P-11 (2026-07-28) — hands the live TipTap `Editor` instance up to the
   * caller so a small, standalone Undo/Redo control (`DocumentUndoRedoControls`)
   * can drive `editor.commands.undo()/redo()` without this component owning
   * any toolbar UI itself. Fires on every editor (re)creation, including
   * `null` on unmount/remount — mirrors the `onAutosaveStatusChange` pattern.
   * ADDITIVE: omit to keep this editor's behaviour byte-identical.
   */
  onEditorInstance?: (editor: Editor | null) => void;
}

export const DocumentTipTapEditor: React.FC<DocumentTipTapEditorProps> = ({
  schema,
  onSchemaUpdated,
  editable = true,
  placeholder,
  className,
  artifactId,
  onAutosaveStatusChange,
  onEditorInstance,
}) => {
  const extensions = useMemo(() => getDocumentEditorExtensions(placeholder), [placeholder]);

  // Always read the freshest schema + callback from refs so the (stable) editor
  // callbacks never close over a stale render.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const onSchemaUpdatedRef = useRef(onSchemaUpdated);
  onSchemaUpdatedRef.current = onSchemaUpdated;
  const onAutosaveStatusChangeRef = useRef(onAutosaveStatusChange);
  onAutosaveStatusChangeRef.current = onAutosaveStatusChange;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdateRef = useRef(false);
  // TipTap may emit `onUpdate` while normalizing its initial ProseMirror
  // document. That is hydration, not a user edit, and must never trigger the
  // manual-content PUT (especially immediately after an SSE `done`, where it
  // could overwrite the server-finalized schema with a transient buffer).
  // Arm autosave only from an actual editing DOM gesture.
  const userEditArmedRef = useRef(false);

  // Optimistic-lock version — the `schema.updatedAt` this editor instance
  // last confirmed against the server (either from the initial load, a
  // successful PUT response, or a conflict-triggered re-fetch). Sent back
  // as `expectedVersion` on every autosave. A ref (not state) because it
  // must be read synchronously inside the debounced save closure without
  // re-triggering renders.
  const versionRef = useRef(schema.updatedAt);
  // Guards against overlapping PUTs: if a keystroke lands while a save is
  // in flight, we remember it and fire exactly one more save on completion
  // instead of racing two PUTs against the same expectedVersion.
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  // Once true, autosave stops firing until a fresh (non-conflicting) schema
  // arrives — prevents hammering the server with doomed retries after a 409.
  const conflictedRef = useRef(false);

  // Initial PM doc — computed once; subsequent schema changes flow through the
  // sync effect below, NOT through a remount.
  const initialDoc = useMemo(() => schemaToProseMirror(schema), [schema.artifactId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Persist the manual edit (sections only) via the same durable overlay
   * layer the AI-proposal / rollback / content-block-insert paths already
   * write through server-side. Content-only save — never touches the
   * proposal/approve pipeline, so it cannot race an approval's own write.
   */
  const persistManualEdit = useCallback(
    async (next: DocumentSchema) => {
      if (!artifactId || conflictedRef.current) return;
      if (saveInFlightRef.current) {
        saveQueuedRef.current = true;
        return;
      }
      saveInFlightRef.current = true;
      onAutosaveStatusChangeRef.current?.('saving');
      try {
        const expectedVersion = versionRef.current;
        if (!expectedVersion) {
          // No version to lock against yet (schema predates this field) —
          // skip rather than risk a lock-free overwrite; the next reload
          // will hydrate `updatedAt` and autosave will engage normally.
          onAutosaveStatusChangeRef.current?.('idle');
          return;
        }
        const saved = await saveDocumentStudioManualContent(artifactId, {
          sections: next.sections,
          expectedVersion,
        });
        versionRef.current = saved.updatedAt;
        onAutosaveStatusChangeRef.current?.('saved');
        onSchemaUpdatedRef.current?.(saved);
      } catch (err) {
        if (err instanceof DocumentManualSaveConflictError) {
          // Someone else (an approved AI proposal, another tab) wrote a
          // newer version. Do NOT force-push the local buffer — re-fetch
          // the authoritative schema and let the sync effect below push it
          // into the live editor without echoing back through onUpdate.
          conflictedRef.current = true;
          onAutosaveStatusChangeRef.current?.('conflict');
          try {
            const fresh = await getDocumentStudioArtifact(artifactId);
            versionRef.current = fresh.schema.updatedAt;
            onSchemaUpdatedRef.current?.(fresh.schema);
          } catch {
            /* best-effort refetch; user can still manually reload */
          } finally {
            conflictedRef.current = false;
          }
        } else {
          onAutosaveStatusChangeRef.current?.('error');
        }
      } finally {
        saveInFlightRef.current = false;
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          void persistManualEdit(schemaRef.current);
        }
      }
    },
    [artifactId]
  );

  const editor = useEditor(
    {
      extensions,
      editable,
      content: initialDoc as unknown as Record<string, unknown>,
      editorProps: {
        handleDOMEvents: {
          beforeinput: () => {
            userEditArmedRef.current = true;
            return false;
          },
          paste: () => {
            userEditArmedRef.current = true;
            return false;
          },
          drop: () => {
            userEditArmedRef.current = true;
            return false;
          },
          cut: () => {
            userEditArmedRef.current = true;
            return false;
          },
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (isExternalUpdateRef.current) return;
        if (!userEditArmedRef.current) return;
        userEditArmedRef.current = false;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const json = ed.getJSON() as unknown as PMDoc;
          const next = proseMirrorToSchema(json, schemaRef.current);
          // Local (parent) state always updates immediately so the rest of
          // the UI (word count, right rail, etc.) reflects the edit even
          // before the network round-trip completes.
          onSchemaUpdatedRef.current?.(next);
          void persistManualEdit(next);
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

  // P-11 — hand the live instance to the caller (Undo/Redo controls). Fires
  // on every (re)creation, including `null` on unmount, so a caller that
  // stores it in state never holds a stale/destroyed editor reference.
  const onEditorInstanceRef = useRef(onEditorInstance);
  onEditorInstanceRef.current = onEditorInstance;
  useEffect(() => {
    onEditorInstanceRef.current?.(editor ?? null);
    return () => {
      onEditorInstanceRef.current?.(null);
    };
  }, [editor]);

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
      versionRef.current = schema.updatedAt;
      return;
    }
    // Heuristic: only force a sync when the incoming schema did NOT originate
    // from our own debounced onUpdate. We detect that by comparing the
    // serialized current editor doc to the incoming schema's PM projection.
    try {
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(schemaToProseMirror(schema));
      if (current !== incoming) {
        syncSchema(schema);
        // An external schema swap (AI proposal approved, rollback, another
        // tab's autosave landing) is the new source of truth — adopt its
        // version so the next local edit locks against it, not a stale one.
        versionRef.current = schema.updatedAt;
      }
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

  const insertStructuredBlock = useCallback(
    (blockType: 'table' | 'risk_table' | 'kpi_strip' | 'image' | 'roadmap' | 'callout') => {
      if (!editor) return;
      const identity = {
        blockId: `blk-${crypto.randomUUID()}`,
        blockType: blockType === 'roadmap' ? 'table' : blockType,
        sourceRef: '',
        isAssumption: false,
      };
      if (blockType === 'callout') {
        const text = window.prompt('Treść wyróżnienia', 'Kluczowa decyzja lub rekomendacja');
        if (!text?.trim()) return;
        userEditArmedRef.current = true;
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'callout',
            attrs: { ...identity, variant: 'info' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: text.trim() }] }],
          })
          .run();
        return;
      }
      if (blockType === 'image') {
        const url = window.prompt('Adres obrazu (https://)', 'https://');
        if (!url?.trim() || !/^https:\/\//i.test(url.trim())) return;
        const alt = window.prompt('Opis alternatywny obrazu', '')?.trim() ?? '';
        const caption = window.prompt('Podpis obrazu (opcjonalnie)', '')?.trim() ?? '';
        userEditArmedRef.current = true;
        editor
          .chain()
          .focus()
          .insertContent({
            type: DOC_IMAGE_NODE_NAME,
            attrs: {
              ...identity,
              payloadJson: JSON.stringify({ url: url.trim(), alt, caption }),
            },
          })
          .run();
        return;
      }

      let payload: Record<string, unknown>;
      if (blockType === 'kpi_strip') {
        const raw = window.prompt('KPI w formacie Nazwa=Wartość; Nazwa=Wartość', 'Postęp=72%');
        if (!raw?.trim()) return;
        const items = raw
          .split(';')
          .map((entry) => entry.split('=').map((part) => part.trim()))
          .filter(([label, value]) => Boolean(label && value))
          .map(([label, value]) => ({ label, value }));
        if (items.length === 0) return;
        payload = { items };
      } else if (blockType === 'risk_table') {
        const raw = window.prompt(
          'Ryzyka: nazwa|prawdopodobieństwo|wpływ|właściciel; …',
          'Adopcja|Średnie|Wysoki|COO'
        );
        if (!raw?.trim()) return;
        payload = {
          columns: ['Ryzyko', 'Prawdopodobieństwo', 'Wpływ', 'Właściciel'],
          rows: raw.split(';').map((row) => row.split('|').map((cell) => cell.trim())),
        };
      } else if (blockType === 'roadmap') {
        const raw = window.prompt(
          'Roadmapa: okres|rezultat|właściciel; …',
          '30 dni|Pilotaż|COO;60 dni|Rollout|CIO;90 dni|Stabilizacja|PMO'
        );
        if (!raw?.trim()) return;
        payload = {
          columns: ['Okres', 'Rezultat', 'Właściciel'],
          rows: raw.split(';').map((row) => row.split('|').map((cell) => cell.trim())),
        };
      } else {
        const raw = window.prompt(
          'Tabela: nagłówki w pierwszym wierszu; pola oddziel |, wiersze oddziel ;',
          'Metryka|Wartość;Postęp|72%'
        );
        if (!raw?.trim()) return;
        const rows = raw.split(';').map((row) => row.split('|').map((cell) => cell.trim()));
        payload = { columns: rows.shift() ?? [], rows };
      }
      userEditArmedRef.current = true;
      editor
        .chain()
        .focus()
        .insertContent({
          type: KPI_STRIP_NODE_NAME,
          attrs: { ...identity, payloadJson: JSON.stringify(payload) },
        })
        .run();
    },
    [editor]
  );

  const findInDocument = useCallback(() => {
    if (!editor) return;
    const query = window.prompt('Znajdź w dokumencie', '')?.trim();
    if (!query) return;
    const needle = query.toLocaleLowerCase();
    const after = editor.state.selection.from;
    const matches: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const haystack = node.text.toLocaleLowerCase();
      let index = haystack.indexOf(needle);
      while (index >= 0) {
        matches.push({ from: pos + index, to: pos + index + query.length });
        index = haystack.indexOf(needle, index + Math.max(1, needle.length));
      }
    });
    const match = matches.find((candidate) => candidate.from > after) ?? matches[0];
    if (!match) {
      window.alert(`Nie znaleziono: ${query}`);
      return;
    }
    editor.chain().focus().setTextSelection(match).scrollIntoView().run();
  }, [editor]);

  const replaceInDocument = useCallback(() => {
    if (!editor) return;
    const query = window.prompt('Znajdź tekst do zamiany', '')?.trim();
    if (!query) return;
    const replacement = window.prompt('Zamień na', '');
    if (replacement === null) return;
    const needle = query.toLocaleLowerCase();
    const matches: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const haystack = node.text.toLocaleLowerCase();
      let index = haystack.indexOf(needle);
      while (index >= 0) {
        matches.push({ from: pos + index, to: pos + index + query.length });
        index = haystack.indexOf(needle, index + Math.max(1, needle.length));
      }
    });
    if (matches.length === 0) {
      window.alert(`Nie znaleziono: ${query}`);
      return;
    }
    userEditArmedRef.current = true;
    for (const match of matches.reverse()) {
      editor.chain().focus().setTextSelection(match).insertContent(replacement).run();
    }
  }, [editor]);

  return (
    <div className={className} data-testid="document-tiptap-editor">
      {editable && editor ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-1 rounded-xl border border-c-border bg-c-surface p-1.5"
          role="toolbar"
          aria-label="Formatowanie dokumentu"
          data-testid="document-formatting-toolbar"
        >
          {[
            {
              label: 'Tekst',
              title: 'Zwykły tekst',
              active: editor.isActive('paragraph'),
              run: () => editor.chain().focus().setParagraph().run(),
            },
            ...([1, 2, 3] as const).map((level) => ({
              label: `H${level}`,
              title: `Nagłówek ${level}`,
              active: editor.isActive('heading', { level }),
              run: () => editor.chain().focus().toggleHeading({ level }).run(),
            })),
            {
              label: '• Lista',
              title: 'Lista punktowana',
              active: editor.isActive('bulletList'),
              run: () => editor.chain().focus().toggleBulletList().run(),
            },
            {
              label: '1. Lista',
              title: 'Lista numerowana',
              active: editor.isActive('orderedList'),
              run: () => editor.chain().focus().toggleOrderedList().run(),
            },
            {
              label: 'B',
              title: 'Pogrubienie (Ctrl/Cmd+B)',
              active: editor.isActive('bold'),
              run: () => editor.chain().focus().toggleBold().run(),
            },
            {
              label: 'I',
              title: 'Kursywa (Ctrl/Cmd+I)',
              active: editor.isActive('italic'),
              run: () => editor.chain().focus().toggleItalic().run(),
            },
            {
              label: 'Link',
              title: 'Dodaj lub edytuj link (Ctrl/Cmd+K)',
              active: editor.isActive('link'),
              run: () => {
                const current = String(editor.getAttributes('link').href ?? '');
                const entered = window.prompt('Adres linku', current || 'https://');
                if (entered === null) return false;
                const value = entered.trim();
                if (!value) return editor.chain().focus().unsetLink().run();
                const href = /^(https?:|mailto:)/i.test(value) ? value : `https://${value}`;
                return editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
              },
            },
            {
              label: 'Usuń link',
              title: 'Usuń link',
              active: false,
              run: () => editor.chain().focus().unsetLink().run(),
            },
            ...(
              [
                ['Wyróżnienie', 'callout'],
                ['Tabela', 'table'],
                ['KPI', 'kpi_strip'],
                ['Ryzyka', 'risk_table'],
                ['Roadmapa', 'roadmap'],
                ['Obraz', 'image'],
              ] as const
            ).map(([label, blockType]) => ({
              label,
              title: `Wstaw: ${label}`,
              active: false,
              run: () => {
                insertStructuredBlock(blockType);
                return true;
              },
            })),
            {
              label: 'Znajdź',
              title: 'Znajdź w dokumencie',
              active: false,
              run: () => {
                findInDocument();
                return true;
              },
            },
            {
              label: 'Zamień',
              title: 'Znajdź i zamień',
              active: false,
              run: () => {
                replaceInDocument();
                return true;
              },
            },
          ].map((action) => (
            <button
              key={action.title}
              type="button"
              aria-label={action.title}
              aria-pressed={action.active}
              title={action.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                // Toolbar commands are programmatic TipTap transactions, so
                // they do not emit the DOM beforeinput event that normally
                // arms manual autosave. Mark them as user edits explicitly.
                userEditArmedRef.current = true;
                action.run();
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                action.active
                  ? 'bg-primary-600 text-white'
                  : 'text-c-text-secondary hover:bg-c-surface-hover hover:text-c-text'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
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
