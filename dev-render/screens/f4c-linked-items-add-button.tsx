/**
 * F4c evidence harness (znalezisko E1a N5, [ODMROZENIE 07_MY_WORK_AGENT DEC-453]).
 *
 * Mounts the REAL `MyWork/shared/LinkedItemsSection` in isolation with mock
 * callbacks — no login, no backend. `isAddingLink`/`isAddingExternal` were
 * declared but nothing in the component ever set them to `true`: both panels
 * (search-and-attach, manual external link) existed and were fully wired to
 * `onAdd`/`searchItems`, but were permanently unreachable (no trigger).
 *
 * URL: ?screen=f4c-linked-items-add-button&theme=light|dark
 */
import '../../src/i18n';

import React, { useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../src/i18n';
import type { LinkedItem } from '../../src/components/MyWork/shared/LinkedItemsSection';
import { LinkedItemsSection } from '../../src/components/MyWork/shared/LinkedItemsSection';

const MOCK_ITEMS: LinkedItem[] = [
  { id: 'task-1', type: 'task', title: 'Konfiguracja Azure DevOps', status: 'in_progress' },
];

const Screen: React.FC = () => {
  const [items, setItems] = useState<LinkedItem[]>(MOCK_ITEMS);
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ maxWidth: 480, margin: '32px auto', fontFamily: 'sans-serif' }}>
      <LinkedItemsSection
        items={items}
        expanded={expanded}
        onToggleExpand={() => setExpanded((prev) => !prev)}
        onAdd={async (item) => {
          setItems((prev) => [...prev, item]);
          return { ok: true };
        }}
        onRemove={async (id) => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          return { ok: true };
        }}
        searchItems={async (query) => [
          { id: 'search-result-1', type: 'task', title: `Wynik dla "${query}"`, status: 'todo' },
        ]}
      />
    </div>
  );
};

export default function F4cLinkedItemsAddButtonScreen() {
  return (
    <I18nextProvider i18n={i18n}>
      <Screen />
    </I18nextProvider>
  );
}
