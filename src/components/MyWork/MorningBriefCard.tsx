import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/useAppStore';

interface MorningBrief {
  newTasks?: { id: string; title: string; priority: string }[];
  overdueTasks?: { id: string; title: string; due_date: string }[];
  dueSoon?: { id: string; title: string; due_date: string }[];
  pendingDecisions?: { id: string; title: string; due_date: string }[];
  recommendation?: string;
  generatedAt?: string;
}

export const MorningBriefCard: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const lastDismissed = localStorage.getItem('mywork-brief-dismissed');
    if (lastDismissed) {
      const d = new Date(lastDismissed);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        setDismissed(true);
        return;
      }
    }
    const fetchBrief = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/my-work/morning-brief', {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) setBrief(await res.json());
      } catch {
        /* ignore */
      }
    };
    fetchBrief();
  }, []);

  if (dismissed || !brief) return null;

  const totalItems =
    (brief.overdueTasks?.length || 0) +
    (brief.dueSoon?.length || 0) +
    (brief.pendingDecisions?.length || 0) +
    (brief.newTasks?.length || 0);
  if (totalItems === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('mywork-brief-dismissed', new Date().toISOString());
  };

  const handlePlanWithAI = () => {
    const msg =
      `Help me plan my day. Here's my morning brief:\n` +
      (brief.overdueTasks?.length ? `- ${brief.overdueTasks.length} overdue tasks\n` : '') +
      (brief.dueSoon?.length ? `- ${brief.dueSoon.length} tasks due soon\n` : '') +
      (brief.pendingDecisions?.length
        ? `- ${brief.pendingDecisions.length} pending decisions\n`
        : '') +
      (brief.newTasks?.length ? `- ${brief.newTasks.length} new tasks\n` : '') +
      `\nSuggest a prioritized plan for today.`;
    setChatKickoffMessage(msg);
    if (isChatCollapsed) toggleChatCollapse();
  };

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl border border-purple-200/50 dark:border-purple-800/30 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/20 dark:to-indigo-950/15 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-500" />
          <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
            {isPolish ? 'Poranny briefing' : 'Morning Brief'}
          </span>
          <span className="text-xs text-purple-500 dark:text-purple-400">
            {totalItems} {isPolish ? 'elementów' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePlanWithAI}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25 transition-all"
          >
            {isPolish ? 'Zaplanuj z AI' : 'Plan with AI'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-lg hover:bg-purple-500/10 text-purple-500"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-purple-500/10 text-purple-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {brief.recommendation && (
            <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
              {brief.recommendation}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-[11px]">
            {(brief.overdueTasks?.length || 0) > 0 && (
              <span className="text-red-600 dark:text-red-400">
                🔴 {brief.overdueTasks!.length} overdue
              </span>
            )}
            {(brief.dueSoon?.length || 0) > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                🟡 {brief.dueSoon!.length} due soon
              </span>
            )}
            {(brief.pendingDecisions?.length || 0) > 0 && (
              <span className="text-purple-600 dark:text-purple-400">
                ⚖️ {brief.pendingDecisions!.length} decisions
              </span>
            )}
            {(brief.newTasks?.length || 0) > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                🆕 {brief.newTasks!.length} new tasks
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
