import { ExternalLink, Link2, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';
import { Api } from '@/services/api';

type Backlink = {
  id: string;
  sourceType: string;
  sourceId: string;
  createdAt?: string;
};

interface IdeaContextPanelProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  title: string;
}

export const IdeaContextPanel: React.FC<IdeaContextPanelProps> = ({ open, onClose, ideaId, title }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Backlink[]>([]);

  const subtitle = useMemo(() => (isPl ? 'Kontekst / powiązania' : 'Context / links'), [isPl]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await Api.getLinkGraphBacklinks({ type: 'idea', id: ideaId, limit: 50 });
        if (cancelled) return;
        setItems(
          (Array.isArray(res) ? res : [])
            .map((x: any) => ({
              id: String(x?.id || ''),
              sourceType: String(x?.sourceType || ''),
              sourceId: String(x?.sourceId || ''),
              createdAt: x?.createdAt ? String(x.createdAt) : undefined,
            }))
            .filter((x) => x.sourceType && x.sourceId)
        );
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [ideaId, open]);

  if (!open) return null;

  const openItem = (type: string, id: string) => {
    if (type === 'initiative') {
      window.dispatchEvent(new CustomEvent('mywork-open-item', { detail: { type, id, name: 'Initiative' } }));
      return;
    }
    if (
      type === 'task' ||
      type === 'decision' ||
      type === 'idea' ||
      type === 'notebook' ||
      type === 'report' ||
      type === 'presentation'
    ) {
      window.dispatchEvent(new CustomEvent('mywork-open-item', { detail: { type, id, name: `${type} ${id}` } }));
    }
  };

  return (
    <ToolsPanelShell
      title={isPl ? 'Powiązania' : 'Links'}
      subtitle={subtitle}
      icon={
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
          <Link2 size={14} className="text-slate-600 dark:text-slate-300" />
        </div>
      }
      onClose={onClose}
    >
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {title || (isPl ? 'Wyzwanie' : 'Idea')}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">{ideaId}</div>
      </div>

      <div className="px-3 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80 dark:text-slate-500/80 mb-2">
          {isPl ? 'Użyte w (backlinks)' : 'Used in (backlinks)'}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1 py-2">
            <Loader2 size={14} className="animate-spin text-slate-400" />
            {isPl ? 'Wczytuję…' : 'Loading…'}
          </div>
        ) : items.length === 0 ? (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
            {isPl ? 'Brak powiązań' : 'No links yet'}
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 12).map((x) => (
              <div
                key={x.id || `${x.sourceType}:${x.sourceId}`}
                className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {x.sourceType}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {x.sourceId}
                    </div>
                  </div>
                  {['task', 'decision', 'idea', 'initiative', 'notebook', 'report', 'presentation'].includes(
                    x.sourceType
                  ) ? (
                    <button
                      onClick={() => openItem(x.sourceType, x.sourceId)}
                      className="flex items-center justify-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 px-2 py-1 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"
                    >
                      <ExternalLink size={12} />
                      {isPl ? 'Otwórz' : 'Open'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolsPanelShell>
  );
};

export default IdeaContextPanel;

