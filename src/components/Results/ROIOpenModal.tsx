import { Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

type Initiative = {
  id: string;
  name: string;
  // CB-04/RB-012: business-safe disambiguation fields — all already returned
  // by GET /initiatives (server/src/routes/initiatives.routes.ts), no new
  // backend contract needed.
  status?: string;
  category?: string;
  createdAt?: string;
};

interface ROIOpenModalProps {
  onClose: () => void;
  onSelect: (initiative: Initiative) => void;
  title?: string;
}

export const ROIOpenModal: React.FC<ROIOpenModalProps> = ({ onClose, onSelect, title }) => {
  const { t } = useTranslation();
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res: any = await Api.get('/initiatives');
        const data = (res?.data ?? res) as any;
        const mapped: Initiative[] = (data || []).map((i: any) => ({
          id: String(i.id),
          name: String(i.name || i.title || i.id),
          status: i.status ? String(i.status) : undefined,
          category: i.category ? String(i.category) : undefined,
          createdAt: i.createdAt ? String(i.createdAt) : undefined,
        }));
        // CB-04/RB-012: the source endpoint has produced exact-ID duplicate
        // rows before (e.g. a join fan-out) — dedupe by business ID (first
        // occurrence wins) so the same initiative never appears as two
        // indistinguishable picker rows.
        const seenIds = new Set<string>();
        const deduped: Initiative[] = [];
        for (const i of mapped) {
          if (seenIds.has(i.id)) continue;
          seenIds.add(i.id);
          deduped.push(i);
        }
        setInitiatives(deduped);
      } catch {
        setInitiatives([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initiatives;
    return initiatives.filter((i) => i.name.toLowerCase().includes(q));
  }, [initiatives, query]);

  // CB-04/RB-012: names that repeat across DIFFERENT ids are legitimate
  // distinct initiatives sharing a title — the picker must disambiguate
  // them with business context, not by falling back to a raw internal ID.
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of initiatives) {
      const key = i.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [initiatives]);

  function formatDisambiguator(i: Initiative): string | null {
    const key = i.name.trim().toLowerCase();
    if ((duplicateNameCounts.get(key) || 0) <= 1) return null;
    const parts: string[] = [];
    if (i.category) parts.push(i.category);
    if (i.status) parts.push(i.status);
    if (i.createdAt) {
      const d = new Date(i.createdAt);
      if (!Number.isNaN(d.getTime())) {
        parts.push(d.toLocaleDateString());
      }
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  const handleSelect = useCallback(
    (initiative: Initiative) => {
      onSelect(initiative);
    },
    [onSelect]
  );

  const inputCls =
    'w-full h-9 pl-9 pr-9 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus focus-visible:border-c-focus-solid transition-colors';

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title || t('results.roi.openModal.title', 'Open ROI')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className={inputCls}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('results.roi.openModal.search', 'Search initiatives…')}
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-700 dark:hover:text-white transition-colors"
                title={t('common.clear', 'Clear')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 dark:border-navy-700">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                {t('results.roi.openModal.empty', 'No initiatives found')}
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-navy-700">
                {filtered.slice(0, 200).map((i) => {
                  const disambiguator = formatDisambiguator(i);
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(i)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {i.name}
                        </div>
                        {/* CB-04/RB-012: business-safe disambiguation (category
                            · status · created date) for same-name initiatives
                            — never the raw internal ID a user can't act on. */}
                        {disambiguator && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {disambiguator}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-full text-sm font-medium border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROIOpenModal;
