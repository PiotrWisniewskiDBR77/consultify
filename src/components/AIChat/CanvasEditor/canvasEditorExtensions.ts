/**
 * TipTap extensions for the Canvas rich editor.
 * Reuses Notebook extensions + adds Canvas-specific nodes.
 */

import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
// Typ z '@tiptap/react' (re-eksport @tiptap/core), by wskazywać TĘ SAMĄ kopię
// @tiptap/core, której używa useEditor. Instalacje z dwiema fizycznymi kopiami
// tej samej wersji pakietu (hoisted + .pnpm) dają nominalnie różne typy
// Node/Extension — rzut jest typowo poprawny (identyczna wersja, ten sam kod).
import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import {
  CalloutNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from '@/components/MyWork/notebook/extensions';

import { AIAddedMark, AIRemovedMark } from './canvasAIDiffExtensions';

export function getCanvasEditorExtensions(placeholder?: string): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Disable StarterKit's bundled link/underline so the explicitly
      // configured Link (openOnClick: false) and Underline below win,
      // avoiding the "Duplicate extension names" warning (TipTap v3).
      link: false,
      underline: false,
    }),
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Placeholder.configure({
      placeholder: placeholder || 'Start typing or press / for commands...',
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Underline,
    CalloutNode,
    DetailsNode,
    DetailsSummaryNode,
    DetailsContentNode,
    AIAddedMark,
    AIRemovedMark,
  ] as AnyExtension[];
}
