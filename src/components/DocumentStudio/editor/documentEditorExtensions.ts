/**
 * Document Studio editor — TipTap extension set (R1).
 *
 * StarterKit (heading levels 1-3) + the table family + the reused notebook
 * `CalloutNode` + the four Document Studio NodeViews (chart / kpi-table /
 * quote / image) + the `docSection` heading marker.
 *
 * GOTCHA (TipTap v3 "Duplicate extension names"): StarterKit bundles `link`
 * and `underline`. We do NOT add our own Link/Underline here, but we still
 * disable them so future inline-AI additions (R2) can register explicit
 * versions without a clash, mirroring `canvasEditorExtensions.ts`.
 */

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
// Typ z '@tiptap/react' (re-eksport @tiptap/core) — patrz uzasadnienie
// w canvasEditorExtensions.ts (dwie fizyczne kopie tej samej wersji core).
import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { CalloutNode } from '@/components/MyWork/notebook/extensions';

import { ChartNode } from './nodes/ChartNode';
import { DocImageNode } from './nodes/DocImageNode';
import { DocSectionNode } from './nodes/DocSectionNode';
import { KpiStripNode } from './nodes/KpiStripNode';
import { QuoteNode } from './nodes/QuoteNode';

export function getDocumentEditorExtensions(placeholder?: string): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Disable StarterKit's bundled link/underline to avoid the
      // "Duplicate extension names" warning if R2 later registers explicit ones.
      link: false,
      underline: false,
    }),
    Placeholder.configure({
      placeholder: placeholder || 'Edit the document…',
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https', 'mailto'],
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutNode,
    DocSectionNode,
    ChartNode,
    KpiStripNode,
    QuoteNode,
    DocImageNode,
  ] as AnyExtension[];
}
