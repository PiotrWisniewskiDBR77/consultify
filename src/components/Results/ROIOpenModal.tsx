import { Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

type Initiative = { id: string; name: string };

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
        const mapped = (data || []).map((i: any) => ({
          id: String(i.id),
          name: String(i.name || i.title || i.id),
        }));
        setInitiatives(mapped);
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
                {filtered.slice(0, 200).map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(i)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {i.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {i.id}
                      </div>
                    </button>
                  </li>
                ))}
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
