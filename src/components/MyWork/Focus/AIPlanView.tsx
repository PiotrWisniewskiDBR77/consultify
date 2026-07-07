import { Clock, Loader2, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PlanBlock {
  start: string;
  label: string;
  type: string;
  hours: number;
  items: { type: string; id?: string; title: string; estimatedHours: number }[];
}

interface AIPlan {
  blocks: PlanBlock[];
  summary: string;
  totalItems: number;
}

interface AIPlanViewProps {
  onClose: () => void;
  /** When embedded in a parent shell, hide internal header. */
  embedded?: boolean;
}

const BLOCK_COLORS: Record<string, string> = {
  deep: 'border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20',
  review: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  collab: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
  admin: 'border-l-slate-400 bg-slate-50/50 dark:bg-slate-950/20',
  plan: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
};

export const AIPlanView: React.FC<AIPlanViewProps> = ({ onClose, embedded = false }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/my-work/focus/ai-plan', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) setPlan(await res.json());
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    fetchPlan();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {!embedded ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-c-info" />
            <span className="text-sm font-semibold">
              {isPolish ? 'Plan dnia AI' : 'AI Day Plan'}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={isPolish ? 'Zamknij' : 'Close'}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className={['flex-1 overflow-auto space-y-3', embedded ? 'p-0' : 'p-4'].join(' ')}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            {isPolish ? 'Generowanie planu...' : 'Generating plan...'}
          </div>
        ) : plan ? (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{plan.summary}</p>
            {plan.blocks.map((block, idx) => (
              <div
                key={idx}
                className={`rounded-lg border-l-4 p-3 ${BLOCK_COLORS[block.type] || ''}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock size={12} className="text-slate-600" />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {block.start} — {block.label}
                  </span>
                  <span className="text-[10px] text-slate-600">{block.hours}h</span>
                </div>
                <div className="space-y-1 ml-5">
                  {block.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {item.estimatedHours > 0 && (
                        <span className="text-[9px] text-slate-600 shrink-0">
                          ~{item.estimatedHours}h
                        </span>
                      )}
                    </div>
                  ))}
                  {block.items.length === 0 && (
                    <span className="text-[10px] text-slate-600 italic">
                      {isPolish ? 'Brak zadań' : 'No items'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="text-xs text-slate-600">
            {isPolish ? 'Nie udało się wygenerować planu' : 'Failed to generate plan'}
          </p>
        )}
      </div>
    </div>
  );
};
