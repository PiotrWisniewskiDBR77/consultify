/**
 * LinkedItemsSection wrapper
 */

import React from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import type { LinkedItem } from '../../MyWork/shared';
import { LinkedItemsSection as SharedLinkedItemsSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const LinkedItemsSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { linkedItems, setLinkedItems, isPolish } = useInitiativeContext();

  return (
    <SharedLinkedItemsSection
      items={linkedItems}
      onAdd={async (item) => {
        setLinkedItems((prev) => [
          ...prev,
          { ...item, id: Math.random().toString(36).substr(2, 9) },
        ]);
        toast.success(isPolish ? 'Element powiązany' : 'Item linked');
      }}
      onRemove={async (id) => {
        setLinkedItems((prev) => prev.filter((i) => i.id !== id));
        toast.success(isPolish ? 'Powiązanie usunięte' : 'Link removed');
      }}
      searchItems={async (query) => {
        const results: LinkedItem[] = [];
        try {
          const ts = await Api.get(`/tasks?search=${query}`);
          (Array.isArray(ts) ? ts : ts?.tasks || []).slice(0, 5).forEach((t: any) => {
            results.push({ id: t.id, type: 'task', title: t.title, status: t.status });
          });
        } catch {}
        try {
          const ds = await Api.get(`/decisions?search=${query}`);
          (Array.isArray(ds) ? ds : ds?.decisions || []).slice(0, 5).forEach((d: any) => {
            results.push({ id: d.id, type: 'decision', title: d.title, status: d.status });
          });
        } catch {}
        return results;
      }}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
