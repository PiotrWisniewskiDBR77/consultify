/**
 * IdeaVotingMode — Voting overlay for canvas nodes.
 *
 * Enables a structured voting session: each user gets N votes,
 * clicks on nodes to vote, optional timer, results sorted by votes.
 */
import { Award, Clock, ThumbsUp, Trophy, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Vote {
  nodeId: string;
  userId: string;
  timestamp: number;
}

export interface IdeaVotingModeProps {
  active: boolean;
  onClose: () => void;
  maxVotes: number;
  timerSeconds?: number;
  timerEndsAt?: number | null;
  ideaId?: string;
  currentUserId?: string;
  nodes: Array<{ id: string; data?: { label?: string } }>;
  voteCounts?: Record<string, number>;
  myVoteCounts?: Record<string, number>;
  persistent?: boolean;
  onVotesChange?: (votes: Record<string, number>) => void;
}

export const IdeaVotingMode: React.FC<IdeaVotingModeProps> = ({
  active,
  onClose,
  maxVotes,
  timerSeconds,
  timerEndsAt,
  ideaId,
  currentUserId,
  nodes,
  voteCounts: externalVoteCounts,
  myVoteCounts: externalMyVoteCounts,
  persistent = false,
  onVotesChange,
}) => {
  const { t } = useTranslation();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [timeLeft, setTimeLeft] = useState(
    timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : timerSeconds || 0
  );
  const [timerActive, setTimerActive] = useState(Boolean(timerEndsAt || timerSeconds));
  const [nodeReactions, setNodeReactions] = useState<Record<string, Record<string, number>>>({});
  const userId = currentUserId || 'current-user';

  useEffect(() => {
    if (!active) {
      if (!persistent) setVotes([]);
      setTimeLeft(
        timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : timerSeconds || 0
      );
      setTimerActive(Boolean(timerEndsAt || timerSeconds));
    }
  }, [active, persistent, timerEndsAt, timerSeconds]);

  useEffect(() => {
    if (!active) return;
    setTimeLeft(
      timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : timerSeconds || 0
    );
    setTimerActive(Boolean(timerEndsAt || timerSeconds));
  }, [active, timerEndsAt, timerSeconds]);

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const myVoteCount = useMemo(() => {
    if (externalMyVoteCounts) {
      return Object.values(externalMyVoteCounts).reduce(
        (sum, count) => sum + Number(count || 0),
        0
      );
    }
    return votes.filter((v) => v.userId === userId).length;
  }, [externalMyVoteCounts, userId, votes]);

  const voteCounts = useMemo(() => {
    if (externalVoteCounts) return externalVoteCounts;
    const counts: Record<string, number> = {};
    for (const v of votes) {
      counts[v.nodeId] = (counts[v.nodeId] || 0) + 1;
    }
    return counts;
  }, [externalVoteCounts, votes]);

  useEffect(() => {
    onVotesChange?.(voteCounts);
  }, [onVotesChange, voteCounts]);

  const handleVote = useCallback(
    (nodeId: string) => {
      if (myVoteCount >= maxVotes) return;
      if ((timerEndsAt || timerSeconds) && timeLeft <= 0) return;
      if (persistent) {
        window.dispatchEvent(
          new CustomEvent('idea-whiteboard-cast-vote', {
            detail: { nodeId, voteTargetId: nodeId, ideaId },
          })
        );
        return;
      }
      setVotes((prev) => [...prev, { nodeId, userId, timestamp: Date.now() }]);
    },
    [ideaId, maxVotes, myVoteCount, persistent, timeLeft, timerEndsAt, timerSeconds, userId]
  );

  const handleUnvote = useCallback(
    (nodeId: string) => {
      if (persistent) return;
      setVotes((prev) => {
        const idx = prev.findIndex((v) => v.nodeId === nodeId && v.userId === userId);
        if (idx === -1) return prev;
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    },
    [persistent, userId]
  );

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0));
  }, [nodes, voteCounts]);

  const timerExpired =
    (timerEndsAt != null || (timerSeconds != null && timerSeconds > 0)) && timeLeft <= 0;

  const handleReact = useCallback((nodeId: string, emojiKey: string) => {
    setNodeReactions((prev) => {
      const nodeR = { ...(prev[nodeId] || {}) };
      nodeR[emojiKey] = (nodeR[emojiKey] || 0) + 1;
      return { ...prev, [nodeId]: nodeR };
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.nodeId && !timerExpired) {
        handleVote(detail.nodeId);
      }
    };
    window.addEventListener('idea-voting-click', handler);
    return () => window.removeEventListener('idea-voting-click', handler);
  }, [active, handleVote, timerExpired]);

  if (!active) return null;

  return (
    <div className="absolute bottom-4 left-4 z-[85] w-[280px]">
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-amber-50 dark:from-amber-900/20 dark:to-amber-900/20 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-500" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {t('myWorkIdeas.votingMode.votingMode')}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <ThumbsUp size={10} className="text-c-info" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                {myVoteCount}/{maxVotes}
              </span>
            </div>
            {timerSeconds != null && timerSeconds > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={10} className={timeLeft > 10 ? 'text-slate-600' : 'text-danger-500'} />
                <span
                  className={`text-[10px] font-semibold ${timeLeft > 10 ? 'text-slate-600 dark:text-slate-400' : 'text-danger-500'}`}
                >
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
          {sortedNodes.map((node, rank) => {
            const count = voteCounts[node.id] || 0;
            const myVotes =
              externalMyVoteCounts?.[node.id] ||
              votes.filter((v) => v.nodeId === node.id && v.userId === userId).length;
            return (
              <div
                key={node.id}
                className="px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-600 w-4">{rank + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {node.data?.label || node.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {count > 0 && (
                      <span className="text-[10px] font-bold text-amber-500">{count}</span>
                    )}
                    {!timerExpired && myVoteCount < maxVotes && (
                      <button
                        onClick={() => handleVote(node.id)}
                        className="p-1 rounded text-slate-600 hover:text-c-info opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ThumbsUp size={10} />
                      </button>
                    )}
                    {!persistent && myVotes > 0 && (
                      <button
                        onClick={() => handleUnvote(node.id)}
                        className="p-1 rounded text-c-info hover:text-danger-500"
                      >
                        <ThumbsUp size={10} className="fill-current" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-0.5 ml-6">
                  <EmojiReactions
                    reactions={nodeReactions[node.id] || {}}
                    onReact={(emojiKey) => handleReact(node.id, emojiKey)}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>

        {timerExpired && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-slate-200/60 dark:border-navy-700/60">
            <div className="flex items-center gap-1.5">
              <Award size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                {t('myWorkIdeas.votingMode.timeSUpResultsAbove')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Emoji Reactions Component ────────────────────────────────────────────────

const EMOJI_REACTIONS = [
  { emoji: '👍', key: 'thumbsup' },
  { emoji: '👎', key: 'thumbsdown' },
  { emoji: '❤️', key: 'heart' },
  { emoji: '🔥', key: 'fire' },
  { emoji: '🤔', key: 'thinking' },
  { emoji: '⚠️', key: 'warning' },
];

export interface EmojiReactionsProps {
  reactions: Record<string, number>;
  onReact: (emoji: string) => void;
  compact?: boolean;
}

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  reactions,
  onReact,
  compact = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const activeReactions = useMemo(
    () => EMOJI_REACTIONS.filter((r) => (reactions[r.key] || 0) > 0),
    [reactions]
  );

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {activeReactions.map((r) => (
        <button
          key={r.key}
          onClick={() => onReact(r.key)}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors text-[10px]"
        >
          <span>{r.emoji}</span>
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            {reactions[r.key]}
          </span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-5 h-5 rounded-full bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 flex items-center justify-center text-[10px] text-slate-600 transition-colors"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 p-1 z-50">
            {EMOJI_REACTIONS.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  onReact(r.key);
                  setShowPicker(false);
                }}
                className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center text-sm transition-colors"
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IdeaVotingMode;
