import { mergeAttributes, Node } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';

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
    const label = String(
      node.attrs.label || node.attrs.title || node.attrs.artifactType || 'Reference'
    );
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

/* ------------------------------------------------------------------ */
/*  Bookmark  (rich link card — title / description / image / favicon)  */
/* ------------------------------------------------------------------ */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attrs: {
        url: string;
        title?: string;
        description?: string;
        image?: string;
        favicon?: string;
      }) => ReturnType;
    };
  }
}

const safeHttpUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
};

/**
 * Block-level bookmark card. Metadata is fetched once (via the SSRF-guarded
 * /api/link-preview) when inserted and stored in attrs, so the node renders
 * statically with no runtime fetch — a single anchor card that opens the link.
 */
export const NotebookBookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    const attr = (name: string, dataKey: string) => ({
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute(dataKey) || '',
      renderHTML: (attrs: Record<string, any>) => (attrs[name] ? { [dataKey]: attrs[name] } : {}),
    });
    return {
      url: attr('url', 'data-url'),
      title: attr('title', 'data-title'),
      description: attr('description', 'data-description'),
      image: attr('image', 'data-image'),
      favicon: attr('favicon', 'data-favicon'),
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-bookmark]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const url = safeHttpUrl(String(node.attrs.url || ''));
    let host = '';
    try {
      host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
    } catch {
      host = '';
    }
    const title = String(node.attrs.title || host || url || 'Link');
    const description = String(node.attrs.description || '');
    const image = safeHttpUrl(String(node.attrs.image || ''));
    const favicon = safeHttpUrl(String(node.attrs.favicon || ''));

    const linkRow: any[] = ['div', { class: 'nb-bookmark-link' }];
    if (favicon) linkRow.push(['img', { class: 'nb-bookmark-favicon', src: favicon, alt: '' }]);
    linkRow.push(['span', {}, host || url]);

    const body: any[] = [
      'div',
      { class: 'nb-bookmark-body' },
      ['div', { class: 'nb-bookmark-title' }, title],
    ];
    if (description) body.push(['div', { class: 'nb-bookmark-desc' }, description]);
    body.push(linkRow);

    const children: any[] = [body];
    if (image)
      children.push(['div', { class: 'nb-bookmark-thumb' }, ['img', { src: image, alt: '' }]]);

    return [
      'a',
      mergeAttributes(
        {
          'data-bookmark': '',
          class: 'nb-bookmark',
          href: url || '#',
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          contenteditable: 'false',
        },
        HTMLAttributes
      ),
      ...children,
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: 'bookmark', attrs }),
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Inline images (paste / drag-drop / upload, resizable)              */
/* ------------------------------------------------------------------ */

/**
 * Image node with an optional persisted `width` attribute so a user-set
 * size survives reload. `allowBase64` lets us inline uploaded images as
 * data: URLs (attachment endpoint serves auth-gated blobs, not public URLs).
 */
export const NotebookImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width') || (el as HTMLElement).style.width || null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          const w = String(attrs.width);
          return {
            width: w,
            style: `width: ${w.endsWith('%') || w.endsWith('px') ? w : `${w}px`}`,
          };
        },
      },
    };
  },
}).configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: { class: 'nb-image' },
});

/* ------------------------------------------------------------------ */
/*  Code block with syntax highlighting + language selection           */
/* ------------------------------------------------------------------ */

/**
 * Shared lowlight instance with a curated grammar set. We register only the
 * languages we surface in the picker (rather than lowlight's full `common`
 * bundle of ~37 grammars) to keep editor init — and the test harness — light.
 */
export const notebookLowlight = createLowlight();

// Register the curated grammar set (statically imported above so Node/Vite
// resolve them natively and cheaply — `common` pulls ~37 grammars and is heavy).
notebookLowlight.register({
  javascript,
  typescript,
  python,
  json,
  bash,
  sql,
  css,
  xml,
  markdown,
  java,
  go,
  rust,
  yaml,
});

/** Languages offered in the code-block language picker (label + lowlight id). */
export const NOTEBOOK_CODE_LANGUAGES: { id: string; label: string }[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'jsx', label: 'JSX / TSX' },
  { id: 'python', label: 'Python' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
  { id: 'css', label: 'CSS' },
  { id: 'xml', label: 'HTML / XML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'yaml', label: 'YAML' },
];

/**
 * CodeBlockLowlight replaces StarterKit's plain codeBlock (same node name
 * `codeBlock`, so `toggleCodeBlock()` keeps working) and adds highlighting.
 * The language picker is rendered as a DOM overlay in NotebookContent.
 */
export const NotebookCodeBlock = CodeBlockLowlight.configure({
  lowlight: notebookLowlight,
  defaultLanguage: 'plaintext',
  HTMLAttributes: { class: 'nb-code-block' },
});
