/**
 * Document Studio editor — section-heading marker node (R1).
 *
 * A `docSection` is a heading-like, inline-editable block that opens each
 * section in the flat document stream. It carries the section's identity
 * (`sectionId`, `level`, `orderIndex`, `purpose`, `sourceRefs`) on its attrs so
 * the inverse converter can re-group the blocks that follow it. The visible
 * content is the editable section title.
 *
 * It is intentionally NOT a StarterKit `heading` (those map to in-body heading
 * BLOCKS). Keeping section markers a distinct node type lets the round-trip
 * distinguish "this h-node opens a section" from "this h-node is a content
 * heading block inside a section".
 */

import { mergeAttributes, Node } from '@tiptap/core';

export const DocSectionNode = Node.create({
  name: 'docSection',
  group: 'block',
  content: 'inline*',
  // Section markers are structural titles, not rich body content. Disallow
  // marks at schema level so keyboard shortcuts cannot bypass the toolbar
  // guard and decorate/corrupt a section marker.
  marks: '',
  defining: true,

  addAttributes() {
    return {
      sectionId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-section-id') || '',
        renderHTML: (attrs) =>
          attrs.sectionId ? { 'data-section-id': String(attrs.sectionId) } : {},
      },
      level: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute('data-level')) || 1,
        renderHTML: (attrs) => ({ 'data-level': String(attrs.level ?? 1) }),
      },
      orderIndex: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-order-index')) || 0,
        renderHTML: (attrs) => ({ 'data-order-index': String(attrs.orderIndex ?? 0) }),
      },
      purpose: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-purpose') || '',
        renderHTML: (attrs) => (attrs.purpose ? { 'data-purpose': String(attrs.purpose) } : {}),
      },
      sourceRefs: {
        default: '[]',
        parseHTML: (el) => el.getAttribute('data-source-refs') || '[]',
        renderHTML: (attrs) => ({ 'data-source-refs': String(attrs.sourceRefs ?? '[]') }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'h2[data-doc-section]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'h2',
      mergeAttributes({ 'data-doc-section': '', class: 'doc-section-title' }, HTMLAttributes),
      0,
    ];
  },
});

export default DocSectionNode;
