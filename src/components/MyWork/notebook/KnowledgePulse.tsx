import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  HeartPulse,
  ListPlus,
  Loader2,
  Scale,
  Target,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { PulseItemPickerModal } from './PulseItemPickerModal';

export interface PulseItem {
  id: string;
  type: 'initiative' | 'task' | 'decision';
  title: string;
  status?: string;
}

interface KnowledgePulseProps {
  noteTitle: string;
  noteTags: string[];
  noteId: string;
  onInsertReference: (item: PulseItem) => void;
  onOpenItem?: (item: PulseItem) => void;
  onClose: () => void;
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

export const KnowledgePulse: React.FC<KnowledgePulseProps> = ({
  noteTitle,
  noteTags,
  noteId,
  onInsertReference,
  onOpenItem,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';
  const [items, setItems] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerType, setPickerType] = useState<'initiative' | 'task' | 'decision' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const searchTerms = [noteTitle, ...noteTags].filter(Boolean).join(' ').trim();
    if (!searchTerms) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const results: PulseItem[] = [];

      try {
        const [initiatives, tasks, decisions] = await Promise.allSettled([
          Api.get(`/initiatives?q=${encodeURIComponent(searchTerms.slice(0, 100))}&limit=5`),
          Api.get(`/my-work/tasks?q=${encodeURIComponent(searchTerms.slice(0, 100))}&limit=5`),
          Api.get(`/decisions?q=${encodeURIComponent(searchTerms.slice(0, 100))}&limit=5`),
        ]);

        if (initiatives.status === 'fulfilled') {
          const list = Array.isArray(initiatives.value)
            ? initiatives.value
            : (initiatives.value as any)?.initiatives || [];
          list.slice(0, 3).forEach((i: any) =>
            results.push({
              id: i.id,
              type: 'initiative',
              title: i.title || i.name,
              status: i.status,
            })
          );
        }
        if (tasks.status === 'fulfilled') {
          const list = Array.isArray(tasks.value) ? tasks.value : (tasks.value as any)?.tasks || [];
          list
            .slice(0, 3)
            .forEach((t: any) =>
              results.push({ id: t.id, type: 'task', title: t.title || t.name, status: t.status })
            );
        }
        if (decisions.status === 'fulfilled') {
          const list = Array.isArray(decisions.value)
            ? decisions.value
            : (decisions.value as any)?.decisions || [];
          list.slice(0, 3).forEach((d: any) =>
            results.push({
              id: d.id,
              type: 'decision',
              title: d.title || d.name,
              status: d.status,
            })
          );
        }
      } catch {
        // silently fail
      }

      if (!cancelled) {
        setItems(results);
        setLoading(false);
        trackFunnelEvent('notebook_pulse_viewed', { noteId, count: results.length });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [noteTitle, noteTags, noteId]);

  const grouped = {
    initiative: items.filter((i) => i.type === 'initiative'),
    task: items.filter((i) => i.type === 'task'),
    decision: items.filter((i) => i.type === 'decision'),
  };

  return (
    <div className="w-72 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2 text-sm font-semibold text-c-danger">
          <HeartPulse size={16} />
          <span>{pl ? 'Knowledge Pulse' : 'Knowledge Pulse'}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-c-text-muted hover:bg-c-surface-raised text-xs"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-c-text-muted" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-xs text-c-text-muted space-y-3">
            <HeartPulse size={24} className="mx-auto mb-2 text-c-text-muted" />
            <p className="font-medium">{pl ? 'Brak powiązań' : 'No connections found'}</p>
            <p className="mt-1">
              {pl
                ? 'Dodaj tagi i treść, aby odkryć powiązania'
                : 'Add tags and content to discover connections'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {(['initiative', 'task', 'decision'] as const).map((t) => {
                const c = TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setPickerType(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${c.bg} ${c.color} hover:opacity-80 transition-opacity`}
                  >
                    <c.icon size={12} />
                    {pl ? c.labelPl : c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          (['initiative', 'task', 'decision'] as const).map((type) => {
            const group = grouped[type];
            const cfg = TYPE_CONFIG[type];
            const Icon = cfg.icon;

            return (
              <div key={type}>
                <div
                  className={`flex items-center justify-between gap-2 px-1 mb-1.5 text-[11px] font-semibold ${cfg.color}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} />
                    <span>{pl ? cfg.labelPl : cfg.label}</span>
                    {group.length > 0 && (
                      <span className={`${cfg.bg} px-1.5 py-0.5 rounded-full text-[10px]`}>
                        {group.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setPickerType(type)}
                    className="text-[10px] font-medium text-c-text-muted hover:text-c-text-secondary flex items-center gap-1 transition-colors"
                    title={
                      pl
                        ? 'Przeglądaj wszystkie i wybierz z listy'
                        : 'Browse all and pick from list'
                    }
                  >
                    <ListPlus size={10} />
                    {pl ? 'Wszystkie' : 'All'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {group.length === 0 ? (
                    <button
                      onClick={() => setPickerType(type)}
                      className="w-full rounded-lg border border-dashed border-c-border-subtle px-3 py-2 text-[11px] text-c-text-muted hover:bg-c-surface-raised hover:border-c-border-strong transition-colors text-left"
                    >
                      {pl ? 'Brak w top 3 — przeglądaj wszystkie' : 'Not in top 3 — browse all'}
                    </button>
                  ) : (
                    group.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2"
                      >
                        <div className="text-xs font-medium text-c-text truncate">
                          {item.title}
                        </div>
                        {item.status && (
                          <div className="mt-0.5 text-[10px] text-c-text-muted capitalize">
                            {item.status}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1">
                          <button
                            onClick={() => onInsertReference(item)}
                            className={`flex-1 flex items-center justify-center gap-1 rounded-md ${cfg.bg} ${cfg.color} px-2 py-1 text-[10px] font-medium hover:opacity-80 transition-opacity`}
                          >
                            <ArrowRight size={10} />
                            {pl ? 'Wstaw' : 'Insert'}
                          </button>
                          {onOpenItem && (
                            <button
                              onClick={() => onOpenItem(item)}
                              className="flex items-center justify-center gap-1 rounded-md bg-c-surface-raised text-c-text-secondary px-2 py-1 text-[10px] font-medium hover:bg-c-surface-raised transition-colors"
                            >
                              <ExternalLink size={10} />
                              {pl ? 'Otwórz' : 'Open'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <PulseItemPickerModal
        open={pickerType !== null}
        onClose={() => setPickerType(null)}
        type={pickerType ?? 'initiative'}
        onInsertReference={onInsertReference}
        onOpenItem={onOpenItem}
      />
    </div>
  );
};
