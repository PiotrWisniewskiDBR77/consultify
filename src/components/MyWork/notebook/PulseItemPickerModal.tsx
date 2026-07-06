/**
 * PulseItemPickerModal — browse all initiatives, tasks, or decisions
 * to link a note to context when top 3 suggestions don't match.
 */
import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  Loader2,
  Scale,
  Search,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from '@/components/ui/primitives/Modal';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export interface PulseItem {
  id: string;
  type: 'initiative' | 'task' | 'decision';
  title: string;
  status?: string;
}

const TYPE_CONFIG = {
  initiative: {
    icon: Target,
    label: 'Initiatives',
    labelPl: 'Inicjatywy',
    color: 'text-c-info',
    bg: 'bg-c-info/10',
  },
  task: {
    icon: CheckSquare,
    label: 'Tasks',
    labelPl: 'Zadania',
    color: 'text-c-success',
    bg: 'bg-c-success/10',
  },
  decision: {
    icon: Scale,
    label: 'Decisions',
    labelPl: 'Decyzje',
    color: 'text-c-warning',
    bg: 'bg-c-warning/10',
  },
} as const;

interface PulseItemPickerModalProps {
  open: boolean;
  onClose: () => void;
  type: 'initiative' | 'task' | 'decision';
  onInsertReference: (item: PulseItem) => void;
  onOpenItem?: (item: PulseItem) => void;
}

async function fetchItems(
  type: 'initiative' | 'task' | 'decision',
  search: string
): Promise<PulseItem[]> {
  const results: PulseItem[] = [];
  const q = search.trim().slice(0, 100);
  const limit = 100;

  try {
    if (type === 'initiative') {
      const url = q
        ? `/initiatives?search=${encodeURIComponent(q)}&limit=${limit}`
        : `/initiatives?limit=${limit}`;
      const res = await Api.get(url);
      const list = Array.isArray(res) ? res : (res as any)?.initiatives || [];
      list.forEach((i: any) =>
        results.push({
          id: i.id,
          type: 'initiative',
          title: i.title || i.name || '',
          status: i.status,
        })
      );
    } else if (type === 'task') {
      const url = q
        ? `/tasks?search=${encodeURIComponent(q)}&limit=${limit}`
        : `/tasks?limit=${limit}`;
      const res = await Api.get(url);
      const list = Array.isArray(res) ? res : (res as any)?.tasks || [];
      list.forEach((t: any) =>
        results.push({
          id: t.id,
          type: 'task',
          title: t.title || t.name || '',
          status: t.status,
        })
      );
    } else {
      const url = q ? `/decisions?limit=${limit}` : `/decisions?limit=${limit}`;
      const res = await Api.get(url);
      const list = Array.isArray(res) ? res : (res as any)?.decisions || [];
      let filtered = list;
      if (q) {
        const lower = q.toLowerCase();
        filtered = list.filter(
          (d: any) =>
            (d.title || d.name || '').toLowerCase().includes(lower) ||
            (d.description || '').toLowerCase().includes(lower)
        );
      }
      filtered.forEach((d: any) =>
        results.push({
          id: d.id,
          type: 'decision',
          title: d.title || d.name || '',
          status: d.status,
        })
      );
    }
  } catch {
    // silently fail
  }
  return results;
}

export const PulseItemPickerModal: React.FC<PulseItemPickerModalProps> = ({
  open,
  onClose,
  type,
  onInsertReference,
  onOpenItem,
}) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';
  const [items, setItems] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const results = await fetchItems(type, debouncedSearch);
    setItems(results);
    setLoading(false);
    trackFunnelEvent('notebook_pulse_picker_opened', { type, count: results.length });
  }, [open, type, debouncedSearch]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;

  const handleInsert = (item: PulseItem) => {
    onInsertReference(item);
    onClose();
  };

  const handleOpen = (item: PulseItem) => {
    onOpenItem?.(item);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pl ? `Wybierz ${cfg.labelPl}` : `Select ${cfg.label}`}
      size="lg"
    >
      <div className="flex flex-col gap-4 min-h-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={pl ? 'Szukaj po tytule...' : 'Search by title...'}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)] text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[280px] max-h-[50vh] space-y-1.5 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-c-text-secondary" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-c-text-muted">
              {pl
                ? 'Brak wyników. Zmień zapytanie lub wybierz inny typ.'
                : 'No results. Try a different search or type.'}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-c-text truncate">
                    {item.title}
                  </div>
                  {item.status && (
                    <div className="mt-0.5 text-[11px] text-c-text-muted capitalize">
                      {item.status}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleInsert(item)}
                    className={`flex items-center gap-1.5 rounded-md ${cfg.bg} ${cfg.color} px-3 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity`}
                  >
                    <ArrowRight size={12} />
                    {pl ? 'Wstaw' : 'Insert'}
                  </button>
                  {onOpenItem && (
                    <button
                      onClick={() => handleOpen(item)}
                      className="flex items-center gap-1.5 rounded-md bg-c-surface-raised text-c-text-secondary px-3 py-1.5 text-xs font-medium hover:bg-c-surface-raised transition-colors"
                    >
                      <ExternalLink size={12} />
                      {pl ? 'Otwórz' : 'Open'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-[11px] text-c-text-muted">
          {pl
            ? 'Wstaw odniesienie do notatki, aby pokazać kontekst rozmowy.'
            : 'Insert a reference into the note to show conversation context.'}
        </p>
      </div>
    </Modal>
  );
};
