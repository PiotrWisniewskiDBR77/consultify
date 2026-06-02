/**
 * TipTap Mark extensions for inline AI diff visualization.
 * - aiAdded: green highlight for AI-generated replacement text
 * - aiRemoved: red strikethrough for original text to be replaced
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export const AIAddedMark = Mark.create({
  name: 'aiAdded',

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: 'span[data-ai-added]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-added': '',
        class: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded px-0.5',
      }),
      0,
    ];
  },
});

export const AIRemovedMark = Mark.create({
  name: 'aiRemoved',

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: 'span[data-ai-removed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-removed': '',
        class: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 line-through opacity-60 rounded px-0.5',
      }),
      0,
    ];
  },
});
