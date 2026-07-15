/**
 * IdeaUnifiedSearch — Cmd+F search overlay for the Idea Workspace canvas.
 *
 * Searches across node labels, descriptions, owners, tags, attachment names,
 * and comment text. Supports arrow-key navigation and click-to-navigate.
 */
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface IdeaUnifiedSearchProps {
  open: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; data?: any }>;
  onHighlightNode: (nodeId: string) => void;
  isPl: boolean;
}

interface SearchHit {
  nodeId: string;
  label: string;
  field: string;
  snippet: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-300/60 dark:bg-amber-500/30 text-inherit rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function collectSearchableFields(node: {
  id: string;
  data?: any;
}): Array<{ field: string; text: string }> {
  const d = node.data || {};
  const fields: Array<{ field: string; text: string }> = [];

  if (d.label) fields.push({ field: 'label', text: String(d.label) });
  if (d.description) fields.push({ field: 'description', text: String(d.description) });
  if (d.owner) fields.push({ field: 'owner', text: String(d.owner) });
  if (Array.isArray(d.tags) && d.tags.length > 0) {
    fields.push({ field: 'tags', text: d.tags.join(', ') });
  }
  if (Array.isArray(d.attachments)) {
    for (const att of d.attachments) {
      if (att?.name) fields.push({ field: 'attachment', text: String(att.name) });
    }
  }
  if (Array.isArray(d.comments)) {
    for (const c of d.comments) {
      if (c?.text) fields.push({ field: 'comment', text: String(c.text) });
    }
  }

  return fields;
}

export const IdeaUnifiedSearch: React.FC<IdeaUnifiedSearchProps> = ({
  open,
  onClose,
  nodes,
  onHighlightNode,
  isPl: _isPl,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const hits: SearchHit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const results: SearchHit[] = [];
    const seen = new Set<string>();

    for (const node of nodes) {
      const fields = collectSearchableFields(node);
      for (const { field, text } of fields) {
        if (text.toLowerCase().includes(q)) {
          const key = `${node.id}::${field}::${text}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({
            nodeId: node.id,
            label: node.data?.label || node.id,
            field,
            snippet: text.length > 120 ? text.slice(0, 120) + '…' : text,
          });
        }
      }
    }

    return results;
  }, [query, nodes]);

  const navigateToHit = useCallback(
    (idx: number) => {
      const hit = hits[idx];
      if (hit) {
        setActiveIndex(idx);
        onHighlightNode(hit.nodeId);
      }
    },
    [hits, onHighlightNode]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, hits.length - 1);
        navigateToHit(next);
        return;
      }
      if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, 0);
        navigateToHit(prev);
        return;
      }
    },
    [activeIndex, hits.length, navigateToHit, onClose]
  );

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const fieldLabel: Record<string, string> = {
    label: t('myWorkIdeas.unifiedSearch.label'),
    description: t('myWorkIdeas.unifiedSearch.description'),
    owner: t('myWorkIdeas.unifiedSearch.owner'),
    tags: t('myWorkIdeas.unifiedSearch.tags'),
    attachment: t('myWorkIdeas.unifiedSearch.attachment'),
    comment: t('myWorkIdeas.unifiedSearch.comment'),
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-lg mx-4 rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/[0.08] shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/40 dark:border-white/[0.06]">
          <Search size={16} className="text-slate-600 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('myWorkIdeas.unifiedSearch.searchNodes')}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 outline-none"
          />
          {hits.length > 0 && (
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500 tabular-nums whitespace-nowrap">
              {activeIndex + 1}/{hits.length}
            </span>
          )}
          {hits.length > 1 && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => navigateToHit(Math.max(activeIndex - 1, 0))}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 transition-colors"
                aria-label={t('myWorkIdeas.unifiedSearch.previous')}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => navigateToHit(Math.min(activeIndex + 1, hits.length - 1))}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 transition-colors"
                aria-label={t('myWorkIdeas.unifiedSearch.next')}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 transition-colors"
            aria-label={t('myWorkIdeas.unifiedSearch.close')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Results list */}
        {query.trim().length >= 2 && (
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
            {hits.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-600 dark:text-slate-500">
                {t('myWorkIdeas.unifiedSearch.noResults')}
              </div>
            ) : (
              hits.map((hit, i) => (
                <button
                  key={`${hit.nodeId}-${hit.field}-${i}`}
                  type="button"
                  data-active={i === activeIndex}
                  onClick={() => navigateToHit(i)}
                  className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-colors border-b border-slate-200/50 dark:border-white/[0.03] last:border-b-0 ${
                    i === activeIndex
                      ? 'bg-amber-50/80 dark:bg-amber-500/10'
                      : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {highlightMatch(hit.label, query)}
                    </span>
                    <span className="text-[9px] font-medium text-slate-600 dark:text-slate-500 uppercase tracking-wider shrink-0">
                      {fieldLabel[hit.field] || hit.field}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                    {highlightMatch(hit.snippet, query)}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IdeaUnifiedSearch;
