/**
 * ActivityFeed — Panel showing history of map changes.
 * Tracks node additions, deletions, edits, AI actions, and status changes.
 */
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  GitBranch,
  MessageSquare,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'node_added' | 'node_deleted' | 'node_edited' | 'node_status' | 'ai_expand' | 'ai_suggestion' | 'comment' | 'vote' | 'convert';
  actor: string;
  nodeLabel?: string;
  nodeId?: string;
  detail?: string;
}

interface ActivityFeedProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  onNavigateToNode?: (nodeId: string) => void;
}

const STORAGE_KEY_PREFIX = 'mm-activity-';
const MAX_ENTRIES = 100;

function loadActivity(ideaId: string): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${ideaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushActivity(ideaId: string, entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
  try {
    const existing = loadActivity(ideaId);
    const full: ActivityEntry = {
      ...entry,
      id: `act-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    const updated = [...existing, full].slice(-MAX_ENTRIES);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${ideaId}`, JSON.stringify(updated));
  } catch {
    // storage full
  }
}

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  node_added: Plus,
  node_deleted: Trash2,
  node_edited: Edit3,
  node_status: Star,
  ai_expand: Sparkles,
  ai_suggestion: Bot,
  comment: MessageSquare,
  vote: Star,
  convert: GitBranch,
};

const TYPE_COLORS: Record<string, string> = {
  node_added: 'text-emerald-500',
  node_deleted: 'text-red-500',
  node_edited: 'text-blue-500',
  node_status: 'text-amber-500',
  ai_expand: 'text-violet-500',
  ai_suggestion: 'text-purple-500',
  comment: 'text-sky-500',
  vote: 'text-amber-500',
  convert: 'text-orange-500',
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  open,
  onClose,
  ideaId,
  onNavigateToNode,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEntries(loadActivity(ideaId));
    }
  }, [ideaId, open]);

  // Listen for new activity events
  useEffect(() => {
    if (!open) return;
    const handler = () => setEntries(loadActivity(ideaId));
    window.addEventListener('mm-activity-update', handler);
    return () => window.removeEventListener('mm-activity-update', handler);
  }, [ideaId, open]);

  const filtered = useMemo(() => {
    const sorted = [...entries].reverse();
    if (!filter) return sorted;
    return sorted.filter((e) => e.type === filter);
  }, [entries, filter]);

  const formatTime = useCallback((ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return isPl ? 'teraz' : 'now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return new Date(ts).toLocaleDateString();
  }, [isPl]);

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[84] w-[340px] max-w-[85vw] bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border-l border-slate-200/60 dark:border-navy-700/60 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200/40 dark:border-navy-700/40">
        <Clock size={14} className="text-amber-500 shrink-0" />
        <span className="text-[11px] font-bold text-slate-800 dark:text-white flex-1">
          {isPl ? 'Aktywność' : 'Activity Feed'}
        </span>
        <span className="text-[10px] text-slate-400">{entries.length}</span>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-slate-200/30 dark:border-navy-700/30 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setFilter(null)}
          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors shrink-0 ${!filter ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {isPl ? 'Wszystko' : 'All'}
        </button>
        {['node_added', 'node_edited', 'ai_expand', 'comment'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors shrink-0 ${filter === t ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[11px] text-slate-400">
            {isPl ? 'Brak aktywności' : 'No activity yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((entry) => {
              const Icon = TYPE_ICONS[entry.type] || Clock;
              const color = TYPE_COLORS[entry.type] || 'text-slate-400';
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 p-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors cursor-default"
                >
                  <Icon size={12} className={`mt-0.5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <span className="font-bold">{entry.actor}</span>{' '}
                      {entry.type === 'node_added' && (isPl ? 'dodał' : 'added')}{' '}
                      {entry.type === 'node_deleted' && (isPl ? 'usunął' : 'deleted')}{' '}
                      {entry.type === 'node_edited' && (isPl ? 'edytował' : 'edited')}{' '}
                      {entry.type === 'node_status' && (isPl ? 'zmienił status' : 'changed status of')}{' '}
                      {entry.type === 'ai_expand' && (isPl ? 'użył AI na' : 'used AI on')}{' '}
                      {entry.type === 'comment' && (isPl ? 'skomentował' : 'commented on')}{' '}
                      {entry.type === 'vote' && (isPl ? 'zagłosował na' : 'voted on')}{' '}
                      {entry.type === 'convert' && (isPl ? 'skonwertował' : 'converted')}{' '}
                      {entry.nodeLabel && (
                        <button
                          onClick={() => entry.nodeId && onNavigateToNode?.(entry.nodeId)}
                          className="font-medium text-blue-500 hover:underline"
                        >
                          "{entry.nodeLabel}"
                        </button>
                      )}
                    </div>
                    {entry.detail && (
                      <div className="text-[9px] text-slate-400 mt-0.5">{entry.detail}</div>
                    )}
                  </div>
                  <span className="text-[8px] text-slate-400 shrink-0 mt-0.5">{formatTime(entry.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
