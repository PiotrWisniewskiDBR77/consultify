import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';

export const collapsedSectionsPluginKey = new PluginKey<CollapsedSectionsState>(
  'documentCollapsedSections'
);

interface CollapsedSectionsState {
  ids: ReadonlySet<string>;
  decorations: DecorationSet;
}

function buildDecorations(doc: ProseMirrorNode, ids: ReadonlySet<string>): DecorationSet {
  const decorations: Decoration[] = [];
  let collapsed = false;

  doc.forEach((node, offset) => {
    if (node.type.name === 'docSection') {
      collapsed = ids.has(String(node.attrs.sectionId ?? ''));
      return;
    }
    if (collapsed) {
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'document-section-body-collapsed',
          'aria-hidden': 'true',
          style: 'display: none !important;',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function setCollapsedSectionsMeta(
  transaction: Transaction,
  sectionIds: ReadonlySet<string>
): Transaction {
  return transaction.setMeta(collapsedSectionsPluginKey, [...sectionIds]);
}

export function createCollapsedSectionsPlugin(): Plugin<CollapsedSectionsState> {
  return new Plugin<CollapsedSectionsState>({
    key: collapsedSectionsPluginKey,
    state: {
      init: () => ({ ids: new Set(), decorations: DecorationSet.empty }),
      apply(transaction, previous, _oldState, newState) {
        const meta = transaction.getMeta(collapsedSectionsPluginKey) as string[] | undefined;
        const ids = meta ? new Set(meta) : previous.ids;
        if (!meta && !transaction.docChanged) return previous;
        return { ids, decorations: buildDecorations(newState.doc, ids) };
      },
    },
    props: {
      decorations(state) {
        return collapsedSectionsPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}

export const CollapsedSectionsExtension = Extension.create({
  name: 'documentCollapsedSections',
  addProseMirrorPlugins() {
    return [createCollapsedSectionsPlugin()];
  },
});
