import { mergeAttributes, Node } from '@tiptap/core';

/* ------------------------------------------------------------------ */
/*  Callout  (info | warning | success | critical)                     */
/* ------------------------------------------------------------------ */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { variant?: string }) => ReturnType;
    };
  }
}

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-variant') || 'info',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-callout': '', class: 'nb-callout' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { variant: attrs?.variant ?? 'info' },
              content: [{ type: 'paragraph' }],
            })
            .run(),
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Details / Toggle  (collapsible section)                            */
/* ------------------------------------------------------------------ */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
      setDetails: () => ReturnType;
    };
  }
}

export const DetailsNode = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => el.hasAttribute('open'),
        renderHTML: (attrs) => (attrs.open ? { open: '' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes({ class: 'nb-details' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setDetails:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { open: true },
              content: [
                {
                  type: 'detailsSummary',
                  content: [{ type: 'text', text: 'Toggle' }],
                },
                {
                  type: 'detailsContent',
                  content: [{ type: 'paragraph' }],
                },
              ],
            })
            .run(),
    };
  },
});

export const DetailsSummaryNode = Node.create({
  name: 'detailsSummary',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML() {
    return ['summary', { class: 'nb-summary' }, 0];
  },
});

export const DetailsContentNode = Node.create({
  name: 'detailsContent',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-details-content]' }];
  },

  renderHTML() {
    return ['div', { 'data-details-content': '', class: 'nb-details-content' }, 0];
  },
});

/* ------------------------------------------------------------------ */
/*  Embedded reference chip (inline artifact link + preview payload)   */
/* ------------------------------------------------------------------ */

export const EmbeddedRefNode = Node.create({
  name: 'embeddedRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      artifactType: {
        default: 'unknown',
        parseHTML: (el) => el.getAttribute('data-artifact-type') || 'unknown',
        renderHTML: (attrs) => ({ 'data-artifact-type': attrs.artifactType }),
      },
      artifactId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-artifact-id') || '',
        renderHTML: (attrs) => ({ 'data-artifact-id': attrs.artifactId }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') || '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      status: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-status') || '',
        renderHTML: (attrs) => ({ 'data-status': attrs.status }),
      },
      snippet: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-snippet') || '',
        renderHTML: (attrs) => ({ 'data-snippet': attrs.snippet }),
      },
      updatedAt: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-updated-at') || '',
        renderHTML: (attrs) => ({ 'data-updated-at': attrs.updatedAt }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') || '',
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'button[data-embedded-ref]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = String(node.attrs.label || node.attrs.title || node.attrs.artifactType || 'Reference');
    return [
      'button',
      mergeAttributes(
        {
          'data-embedded-ref': '',
          type: 'button',
          class: 'nb-embedded-ref',
          contenteditable: 'false',
        },
        HTMLAttributes
      ),
      label,
    ];
  },
});
