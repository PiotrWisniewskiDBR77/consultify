/**
 * LinkedItemsSection wrapper.
 *
 * M13 Depth · K3 — links are now PERSISTED via /initiatives/:id/linked-items
 * (previously React-state only → lost on reload). Items are keyed by the link
 * row id so removal targets the right row. Fail-open: API errors fall back to
 * local state so the section never breaks.
 */

import React, { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { initiativeId, linkedItems, setLinkedItems } = useInitiativeContext();

  // Load persisted links on first expand.
  useEffect(() => {
    if (!expanded || !initiativeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await Api.get(`/initiatives/${initiativeId}/linked-items`);
        const rows = (res?.items ?? res) || [];
        if (cancelled || !Array.isArray(rows)) return;
        setLinkedItems(
          rows.map((r: any) => ({
            id: String(r.id),
            type: r.targetType,
            title: r.label || r.targetId,
            status: undefined,
          })) as LinkedItem[]
        );
      } catch {
        /* fail-open: keep whatever is already in state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, initiativeId, setLinkedItems]);

  return (
    <SharedLinkedItemsSection
      items={linkedItems}
      onAdd={async (item) => {
        try {
          const res: any = await Api.post(`/initiatives/${initiativeId}/linked-items`, {
            targetType: item.type,
            targetId: item.id,
            label: item.title,
          });
          const saved = res?.item ?? res;
          setLinkedItems((prev) => [...prev, { ...item, id: String(saved?.id || item.id) }]);
          toast.success(t('initiatives.linkedItemsSection.itemLinked'));
          return { ok: true } as const;
        } catch (error) {
          toast.error(t('initiatives.linkedItemsSection.linkError', 'Nie udało się dodać linku'));
          return { ok: false, error } as const;
        }
      }}
      onRemove={async (id) => {
        const prevItems = linkedItems;
        setLinkedItems((prev) => prev.filter((i) => i.id !== id));
        try {
          await Api.delete(`/initiatives/${initiativeId}/linked-items/${id}`);
          toast.success(t('initiatives.linkedItemsSection.linkRemoved'));
          return { ok: true } as const;
        } catch (error) {
          setLinkedItems(prevItems); // rollback on failure
          toast.error(t('initiatives.linkedItemsSection.linkError', 'Nie udało się usunąć linku'));
          return { ok: false, error } as const;
        }
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
