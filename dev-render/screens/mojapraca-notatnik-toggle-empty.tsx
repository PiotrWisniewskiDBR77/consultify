/**
 * Dev-render host for H2 [ZLECENIE 1.1-H / ODMROZENIE 07_MY_WORK_AGENT] —
 * "Q2 Strategy" note showed an empty "▼ Toggle" block (untranslated summary,
 * no visible content) instead of note content.
 *
 * Mounts a REAL Tiptap editor with the REAL notebook extensions
 * (DetailsNode/DetailsSummaryNode/DetailsContentNode + Placeholder, imported
 * verbatim from `src/components/MyWork/notebook/extensions.ts`) and the REAL
 * `EDITOR_STYLES` CSS block from `NotebookContent.tsx` — not a hand-copied
 * approximation. `&case=empty-toggle` reproduces the exact reported doc
 * shape (a toggle block whose body is a single empty paragraph); `&case=text`
 * shows a toggle with real content for contrast.
 *
 * Root cause (see InterviewAssignmentService/extensions.ts/NotebookContent.tsx
 * comments marked H2): (1) the toggle's default summary text was the
 * hardcoded English word "Toggle" regardless of app language: fixed via
 * `DetailsNode.configure({ defaultSummaryText: t(...) })`. (2) Tiptap's
 * Placeholder extension only ever decorates `doc.firstChild` unless
 * `includeChildren: true` is set, and even then only the node holding the
 * CURRENT selection unless `showOnlyCurrent: false` is set — a note whose
 * only content is a toggle has no paragraph as `doc.firstChild` (the
 * `details` node is), so an empty toggle body rendered as a blank area with
 * no placeholder at all. (3) the CSS placeholder rule required
 * `:first-child` of `.ProseMirror`, which a nested toggle-body paragraph
 * never is — widened to also match `.nb-details-content p.is-editor-empty`.
 */
import { Placeholder } from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React from 'react';

import {
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from '../../src/components/MyWork/notebook/extensions';
import { EDITOR_STYLES } from '../../src/components/MyWork/NotebookContent';

function useQueryParam(name: string, fallback: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || fallback;
}

const DOCS: Record<string, unknown> = {
  'empty-toggle': {
    type: 'doc',
    content: [
      {
        type: 'details',
        attrs: { open: true },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Toggle' }] },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] },
        ],
      },
    ],
  },
  text: {
    type: 'doc',
    content: [
      {
        type: 'details',
        attrs: { open: true },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Rozwiń' }] },
          {
            type: 'detailsContent',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Ekspansja na rynek DE w Q2, budżet 120k EUR.' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

function ToggleEditor({ isPl, docCase }: { isPl: boolean; docCase: string }): React.ReactElement {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: false,
        placeholder: ({ node, pos, editor: ed }) => {
          if (node.type.name === 'paragraph' && node.content.size === 0) {
            const parentType = ed.state.doc.resolve(pos).parent?.type?.name;
            if (parentType === 'detailsContent') {
              return isPl ? 'Brak treści' : 'No content';
            }
          }
          return isPl ? 'Zacznij pisać… Wpisz / aby wstawić blok' : 'Start writing… Type / to insert a block';
        },
      }),
      DetailsNode.configure({ defaultSummaryText: isPl ? 'Rozwiń' : 'Toggle' }),
      DetailsSummaryNode,
      DetailsContentNode,
    ],
    content: DOCS[docCase] || DOCS['empty-toggle'],
  });

  return (
    <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-c-text">
        {isPl ? 'Q2 Strategy — Market expansion playbook' : 'Q2 Strategy — Market expansion playbook'}
      </h2>
      <p className="mb-4 text-xs text-c-text-muted" data-dev-render-chrome="true">
        {docCase === 'empty-toggle'
          ? isPl
            ? 'Przypadek zgłoszony (H2): jedyna treść notatki to zwinięty toggle bez treści.'
            : 'Reported case (H2): the note contains only an empty toggle.'
          : isPl
            ? 'Kontrast: toggle z realną treścią.'
            : 'Contrast: toggle with real content.'}
      </p>
      <style>{EDITOR_STYLES}</style>
      <EditorContent editor={editor} />
    </div>
  );
}

export default function MojaPracaNotatnikToggleEmptyScreen(): React.ReactElement {
  const lang = useQueryParam('lang', 'pl');
  const docCase = useQueryParam('case', 'empty-toggle');
  const isPl = lang === 'pl';

  return (
    <div className="flex h-full w-full items-start justify-center bg-c-bg p-10">
      <div className="w-[640px] shrink-0">
        <h1 className="mb-4 text-sm font-semibold text-c-text" data-dev-render-chrome="true">
          H2 — Notatnik: pusty blok toggle (&case=empty-toggle|text, &lang=pl|en)
        </h1>
        <ToggleEditor isPl={isPl} docCase={docCase} />
      </div>
    </div>
  );
}
