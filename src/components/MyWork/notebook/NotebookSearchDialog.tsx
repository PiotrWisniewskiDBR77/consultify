/**
 * NotebookSearchDialog — MYW-NBK-004 ("complete artifact graph + fast search
 * across all notebooks: title, content, tags, topics, people/project,
 * related artifacts, filters, highlights, keyboard").
 *
 * `Api.notebookSemanticSearch` (`GET /notebook/search`, V4-NOTE-04) already
 * existed with zero UI consumers — this wires a real, self-contained search
 * surface onto it. Scope note: the endpoint returns pageId/title/snippet/
 * score/matchType only (no tags/topics/people/related-artifacts facets), so
 * this closes the "fast search" half of MYW-NBK-004 (title/content, across
 * every notebook, keyboard-operable, click-through) — the richer faceted
 * filters/highlights the owner also asked for remain open (register: still
 * CZĘŚCIOWE, not ZROBIONE_W_KODZIE).
 *
 * Visual pattern mirrors `src/components/shared/FolderCreateDialog.tsx`
 * (portal, `role="dialog"`, `c-surface`/`c-border-subtle` tokens, `c-focus`
 * ring) — zero crimson, no own table/list canon violated (this is a search
 * results list inside a dialog, not a module list screen).
 */
import { Loader2, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

export interface NotebookSearchResult {
  pageId: string;
  title: string;
  snippet: string;
  score: number;
  matchType: string;
}

export interface NotebookSearchDialogProps {
  open: boolean;
  onClose: () => void;
  /** Opens the chosen page in the current notebook workspace. */
  onOpenPage: (pageId: string) => void;
}

const FIELD_CLASS =
  'w-full h-10 rounded-lg border border-c-border bg-c-surface pl-9 pr-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

export const NotebookSearchDialog: React.FC<NotebookSearchDialogProps> = ({
  open,
  onClose,
  onOpenPage,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NotebookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  // Reset on every open — otherwise a reopened dialog shows the previous
  // session's stale query/results for a beat before the effect below runs.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setError(null);
    setActiveIndex(0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  // Debounced search-as-you-type, with a monotonic sequence guard so a
  // slow earlier response can never overwrite a faster later one.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const debounce = window.setTimeout(() => {
      Api.notebookSemanticSearch(trimmed, { limit: 20 })
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setResults(res?.results ?? []);
          setActiveIndex(0);
        })
        .catch(() => {
          if (seq !== requestSeq.current) return;
          setResults([]);
          setError(
            t('notebook.notebookContent.searchAllNotebooksFailed', isPolish ? 'Wyszukiwanie nie powiodło się' : 'Search failed')
          );
        })
        .finally(() => {
          if (seq !== requestSeq.current) return;
          setLoading(false);
        });
    }, 250);
    return () => window.clearTimeout(debounce);
    // `t` is intentionally excluded: react-i18next's real useTranslation()
    // returns a memoized `t`, but nothing guarantees that in every possible
    // test double, and including a function reference here would re-fire
    // this effect (and its setState calls) on every render — an infinite
    // loop that has nothing to do with the actual search behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, isPolish]);

  const selectResult = (pageId: string) => {
    onOpenPage(pageId);
    onClose();
  };

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-overlay flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t('notebook.notebookContent.searchAllNotebooks', isPolish ? 'Szukaj we wszystkich notatnikach' : 'Search all notebooks')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[activeIndex]) {
          e.preventDefault();
          selectResult(results[activeIndex].pageId);
        }
      }}
    >
      <div className="w-full max-w-lg bg-c-surface border border-c-border-subtle rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
          <h2 className="text-sm font-semibold text-c-text">
            {t('notebook.notebookContent.searchAllNotebooks', isPolish ? 'Szukaj we wszystkich notatnikach' : 'Search all notebooks')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
            title={t('common.close', isPolish ? 'Zamknij' : 'Close')}
            aria-label={t('common.close', isPolish ? 'Zamknij' : 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted pointer-events-none"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                'notebook.notebookContent.searchAllNotebooksPlaceholder',
                isPolish ? 'Szukaj po tytule, treści, tagach…' : 'Search title, content, tags…'
              )}
              className={FIELD_CLASS}
              data-testid="notebook-search-dialog-input"
              aria-label={t('notebook.notebookContent.searchAllNotebooks', isPolish ? 'Szukaj we wszystkich notatnikach' : 'Search all notebooks')}
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-2 pb-2" role="listbox" aria-label={t('notebook.notebookContent.searchAllNotebooks', 'Search all notebooks')}>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-c-text-muted">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : error ? (
            <div role="alert" className="px-3 py-4 text-[12px] text-c-danger">
              {error}
            </div>
          ) : !query.trim() ? (
            <div className="px-3 py-8 text-center text-[12px] text-c-text-muted">
              {t(
                'notebook.notebookContent.searchAllNotebooksPrompt',
                isPolish ? 'Wpisz frazę, aby przeszukać wszystkie notatniki' : 'Type to search across every notebook'
              )}
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12px] text-c-text-muted" data-testid="notebook-search-dialog-empty">
              {t(
                'notebook.notebookContent.searchAllNotebooksEmpty',
                isPolish ? 'Brak pasujących stron' : 'No matching pages'
              )}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {results.map((result, index) => (
                <li key={result.pageId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    data-testid="notebook-search-dialog-result"
                    onClick={() => selectResult(result.pageId)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                      index === activeIndex ? 'bg-c-surface-raised' : 'hover:bg-c-surface-raised'
                    }`}
                  >
                    <div className="text-sm font-medium text-c-text truncate">{result.title}</div>
                    {result.snippet ? (
                      <div className="text-[11px] text-c-text-muted line-clamp-2 mt-0.5">
                        {result.snippet}
                      </div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) return dialog;
  return createPortal(dialog, document.body);
};

export default NotebookSearchDialog;
