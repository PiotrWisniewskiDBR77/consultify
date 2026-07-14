/**
 * ActivityFeed — Panel showing history of map changes.
 * Primary storage: backend API. Falls back to localStorage when API unavailable.
 */
import {
  Bot,
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

import { Api } from '@/services/api';

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type:
    | 'node_added'
    | 'node_deleted'
    | 'node_edited'
    | 'node_status'
    | 'ai_expand'
    | 'ai_suggestion'
    | 'comment'
    | 'vote'
    | 'convert';
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
const MAX_LOCAL_ENTRIES = 100;

function loadLocalActivity(ideaId: string): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${ideaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalActivity(ideaId: string, entries: ActivityEntry[]) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${ideaId}`,
      JSON.stringify(entries.slice(-MAX_LOCAL_ENTRIES))
    );
  } catch {
    /* storage full */
  }
}

/**
 * Fire-and-forget activity push. Tries backend first, falls back to localStorage.
 */
export function pushActivity(ideaId: string, entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
  const full: ActivityEntry = {
    ...entry,
    id: `act-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    timestamp: Date.now(),
  };

  // Always save locally as immediate fallback
  const existing = loadLocalActivity(ideaId);
  const updated = [...existing, full].slice(-MAX_LOCAL_ENTRIES);
  saveLocalActivity(ideaId, updated);

  // Try backend (fire-and-forget)
  Api.createMyIdeaActivity(ideaId, {
    type: entry.type,
    actor: entry.actor,
    nodeId: entry.nodeId,
    nodeLabel: entry.nodeLabel,
    detail: entry.detail,
  }).catch(() => {
    /* API unavailable, localStorage already has it */
  });

  window.dispatchEvent(new CustomEvent('mm-activity-update'));
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
  node_added: 'text-c-success',
  node_deleted: 'text-c-danger',
  node_edited: 'text-c-info',
  node_status: 'text-c-warning',
  ai_expand: 'text-c-accent',
  ai_suggestion: 'text-c-accent',
  comment: 'text-c-info',
  vote: 'text-c-warning',
  convert: 'text-c-warning',
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  open,
  onClose,
  ideaId,
  onNavigateToNode,
}) => {
  const { t } = useTranslation();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await Api.getMyIdeaActivity(ideaId, { limit: 200 });
        if (!cancelled && Array.isArray(data?.entries)) {
          setEntries(data.entries);
          return;
        }
      } catch {
        /* API unavailable */
      }

      if (!cancelled) {
        setEntries(loadLocalActivity(ideaId));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ideaId, open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => {
      setEntries(loadLocalActivity(ideaId));
    };
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
    if (diff < 60_000) return t('ideas.mindmap.now', 'now');
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return new Date(ts).toLocaleDateString();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 z-dropdown w-[340px] max-w-[85vw] bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border-l border-c-border-subtle dark:border-c-border-subtle shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
        <Clock size={14} className="text-c-warning shrink-0" />
        <span className="text-[11px] font-bold text-c-text dark:text-c-text flex-1">
          {t('ideas.mindmap.activityFeed', 'Activity Feed')}
        </span>
        <span className="text-[10px] text-c-text-secondary">{entries.length}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-c-border-subtle dark:border-c-border-subtle flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setFilter(null)}
          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors shrink-0 ${!filter ? 'bg-c-surface-raised text-c-warning dark:text-c-warning' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
        >
          {t('ideas.mindmap.all', 'All')}
        </button>
        {['node_added', 'node_edited', 'ai_expand', 'comment'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors shrink-0 ${filter === t ? 'bg-c-surface-raised text-c-warning dark:text-c-warning' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[11px] text-c-text-secondary">
            {t('ideas.mindmap.noActivityYet', 'No activity yet')}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((entry) => {
              const Icon = TYPE_ICONS[entry.type] || Clock;
              const color = TYPE_COLORS[entry.type] || 'text-c-text-secondary';
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 p-2 rounded-xl hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors cursor-default"
                >
                  <Icon size={12} className={`mt-0.5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted leading-relaxed">
                      <span className="font-bold">{entry.actor}</span>{' '}
                      {entry.type === 'node_added' && t('ideas.mindmap.added', 'added')}{' '}
                      {entry.type === 'node_deleted' && t('ideas.mindmap.deleted', 'deleted')}{' '}
                      {entry.type === 'node_edited' && t('ideas.mindmap.edited', 'edited')}{' '}
                      {entry.type === 'node_status' &&
                        t('ideas.mindmap.changedStatus', 'changed status of')}{' '}
                      {entry.type === 'ai_expand' && t('ideas.mindmap.usedAi', 'used AI on')}{' '}
                      {entry.type === 'comment' && t('ideas.mindmap.commentedOn', 'commented on')}{' '}
                      {entry.type === 'vote' && t('ideas.mindmap.votedOn', 'voted on')}{' '}
                      {entry.type === 'convert' && t('ideas.mindmap.converted2', 'converted')}{' '}
                      {entry.nodeLabel && (
                        <button
                          onClick={() => entry.nodeId && onNavigateToNode?.(entry.nodeId)}
                          className="font-medium text-c-info hover:underline"
                        >
                          "{entry.nodeLabel}"
                        </button>
                      )}
                    </div>
                    {entry.detail && entry.type === 'comment' ? (
                      <div className="text-[9px] text-c-text-secondary mt-1 pl-2 border-l-2 border-c-info italic leading-relaxed">
                        "{entry.detail}"
                      </div>
                    ) : entry.detail ? (
                      <div className="text-[9px] text-c-text-secondary mt-0.5">{entry.detail}</div>
                    ) : null}
                  </div>
                  <span className="text-[8px] text-c-text-secondary shrink-0 mt-0.5">
                    {formatTime(entry.timestamp)}
                  </span>
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
