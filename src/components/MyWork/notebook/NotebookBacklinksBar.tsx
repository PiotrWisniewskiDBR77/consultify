import { Link2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

/**
 * NotebookBacklinksBar — K1 "Mentioned in" strip for the Living Notebook editor.
 *
 * Surfaces the *incoming* side of the knowledge graph: which entities reference
 * the current note (the backlinks already powering NotebookContextPanel), shown
 * compactly right where you write instead of only in the side panel. Each chip
 * opens its entity via the shared `mywork-open-item` event. Renders nothing when
 * the note has no backlinks, so it never adds empty chrome.
 *
 * Reuses the exact Context-panel fetch path: getLinkGraphBacklinks (notebook +
 * notebook_page) → notebookResolveEmbedChips for titles.
 */

const EMOJI: Record<string, string> = {
  initiative: '🎯',
  task: '✓',
  decision: '⚖️',
  idea: '💡',
  notebook: '📄',
  notebook_page: '📄',
  report: '📊',
  presentation: '📽️',
  sheet: '📈',
  assessment: '📋',
};

interface BacklinkChip {
  type: string;
  id: string;
  title: string;
  status?: string;
}

interface NotebookBacklinksBarProps {
  noteId: string;
  isPolish: boolean;
  /** Bump to force a refetch (e.g. after the note's links change). */
  refreshKey?: number;
}

export const NotebookBacklinksBar: React.FC<NotebookBacklinksBarProps> = ({
  noteId,
  isPolish,
  refreshKey = 0,
}) => {
  const { t } = useTranslation();
  const [chips, setChips] = useState<BacklinkChip[]>([]);

  useEffect(() => {
    if (!noteId) {
      setChips([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [aRes, bRes] = await Promise.allSettled([
          Api.getLinkGraphBacklinks({ type: 'notebook', id: noteId, limit: 50 }),
          Api.getLinkGraphBacklinks({ type: 'notebook_page', id: noteId, limit: 50 }),
        ]);
        const rows = [
          ...(aRes.status === 'fulfilled' && Array.isArray(aRes.value)
            ? (aRes.value as any[])
            : []),
          ...(bRes.status === 'fulfilled' && Array.isArray(bRes.value)
            ? (bRes.value as any[])
            : []),
        ]
          .map((x: any) => ({ type: String(x?.sourceType || ''), id: String(x?.sourceId || '') }))
          .filter((x) => x.type && x.id);

        // De-dupe (a source can appear via both backlink queries).
        const seen = new Set<string>();
        const uniq = rows.filter((r) => {
          const k = `${r.type}:${r.id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        if (uniq.length === 0) {
          if (!cancelled) setChips([]);
          return;
        }

        const resolved = await Api.notebookResolveEmbedChips(uniq.slice(0, 20));
        if (cancelled) return;
        const byKey = new Map<string, { title: string; status?: string }>(
          ((resolved as any)?.chips || []).map((c: any) => [
            `${c.artifactType}:${c.artifactId}`,
            { title: String(c.title || ''), status: c.status ? String(c.status) : undefined },
          ])
        );
        setChips(
          uniq.map((r) => {
            const meta = byKey.get(`${r.type}:${r.id}`);
            return {
              type: r.type,
              id: r.id,
              title: meta?.title || `${r.type} ${r.id.slice(0, 6)}`,
              status: meta?.status,
            };
          })
        );
      } catch {
        if (!cancelled) setChips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId, refreshKey]);

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-c-text-muted">
        <Link2 size={12} />
        {t('notebook.backlinksBar.label', 'Mentioned in')}
      </span>
      {chips.map((chip) => (
        <button
          key={`${chip.type}:${chip.id}`}
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('mywork-open-item', {
                detail: { type: chip.type, id: chip.id, name: chip.title },
              })
            )
          }
          title={chip.status ? `${chip.title} · ${chip.status}` : chip.title}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-0.5 text-[11px] text-c-text-secondary transition-colors hover:bg-c-surface-raised dark:border-navy-700 dark:bg-navy-900 dark:text-c-text-secondary dark:hover:bg-white/[0.04]"
        >
          <span className="leading-none">{EMOJI[chip.type] || '🔗'}</span>
          <span className="truncate">{chip.title}</span>
        </button>
      ))}
    </div>
  );
};

export default NotebookBacklinksBar;
