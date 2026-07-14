import { AlertTriangle, Clock, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Nudge {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  actionUrl?: string;
}

export const NudgeStrip: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [nudges, setNudges] = useState<Nudge[]>([]);

  useEffect(() => {
    const fetchNudges = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/ai/nudges', {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setNudges(Array.isArray(data) ? data.slice(0, 3) : data.nudges?.slice(0, 3) || []);
        }
      } catch {
        /* ignore */
      }
    };
    fetchNudges();
  }, []);

  const handleDismiss = async (nudgeId: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/ai/nudges/${encodeURIComponent(nudgeId)}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch {
      /* ignore */
    }
  };

  if (nudges.length === 0) return null;

  return (
    <div className="mx-4 mb-2 space-y-1.5">
      {nudges.map((nudge) => (
        <div
          key={nudge.id}
          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${
            nudge.priority === 'high'
              ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200/50 dark:border-danger-800/30'
              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {nudge.priority === 'high' ? (
              <AlertTriangle size={14} className="text-danger-500 shrink-0" />
            ) : (
              <Clock size={14} className="text-amber-500 shrink-0" />
            )}
            <span
              className={`font-medium truncate ${
                nudge.priority === 'high'
                  ? 'text-danger-700 dark:text-danger-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {nudge.message}
            </span>
          </div>
          <button
            onClick={() => handleDismiss(nudge.id)}
            aria-label={i18n.language === 'pl' ? 'Odrzuć' : 'Dismiss'}
            className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
          >
            <X size={12} className="text-slate-600" />
          </button>
        </div>
      ))}
    </div>
  );
};
