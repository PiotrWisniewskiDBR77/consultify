/**
 * CollaborationPresence — Real-time presence indicators for the Idea Table.
 *
 * Shows: avatar bubbles of active collaborators, colored cell cursors,
 * "typing…" indicators, and a presence bar at the top.
 * Uses SSE/polling to sync presence state.
 */
import { Circle, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  activeCell?: { nodeId: string; colKey: string };
  lastSeen: number;
  isTyping?: boolean;
}

interface CollaborationPresenceProps {
  ideaId: string;
  currentUserId: string;
  currentUserName: string;
  enabled?: boolean;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
}

const PRESENCE_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#f97316',
  '#84cc16',
];

const STALE_THRESHOLD_MS = 30000;
const POLL_INTERVAL_MS = 5000;

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const CollaborationPresence: React.FC<CollaborationPresenceProps> = ({
  ideaId,
  currentUserId,
  currentUserName,
  enabled = true,
  onPresenceUpdate,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myColor = useMemo(
    () =>
      PRESENCE_COLORS[
        Math.abs(currentUserId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) %
          PRESENCE_COLORS.length
      ],
    [currentUserId]
  );

  const broadcastPresence = useCallback(
    async (activeCell?: { nodeId: string; colKey: string }) => {
      if (!enabled) return;
      try {
        const { Api } = await import('@/services/api');
        await Api.broadcastIdeaPresence(ideaId, {
          userId: currentUserId,
          userName: currentUserName,
          color: myColor,
          activeCell,
          timestamp: Date.now(),
        });
      } catch {
        // silent — presence is best-effort
      }
    },
    [currentUserId, currentUserName, enabled, ideaId, myColor]
  );

  const fetchPresence = useCallback(async () => {
    if (!enabled) return;
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaPresence(ideaId);
      if (Array.isArray(result?.users)) {
        const now = Date.now();
        const active = (result.users as PresenceUser[]).filter(
          (u) => u.id !== currentUserId && now - u.lastSeen < STALE_THRESHOLD_MS
        );
        setRemoteUsers(active);
        onPresenceUpdate?.(active);
      }
    } catch {
      // silent
    }
  }, [currentUserId, enabled, ideaId, onPresenceUpdate]);

  useEffect(() => {
    if (!enabled) return;
    broadcastPresence();
    fetchPresence();
    pollRef.current = setInterval(() => {
      broadcastPresence();
      fetchPresence();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [broadcastPresence, enabled, fetchPresence]);

  const activeUsers = remoteUsers.filter((u) => Date.now() - u.lastSeen < STALE_THRESHOLD_MS);

  if (!enabled || activeUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2">
      <Users size={11} className="text-slate-400" />
      <div className="flex items-center -space-x-1.5">
        {activeUsers.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className="relative group"
            title={`${user.name}${user.isTyping ? (isPl ? ' (pisze…)' : ' (typing…)') : ''}`}
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-5 h-5 rounded-full border-2 border-white dark:border-navy-900"
                style={{ borderColor: user.color }}
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center text-[7px] font-black text-white"
                style={{ backgroundColor: user.color }}
              >
                {getInitials(user.name)}
              </div>
            )}
            {user.isTyping && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white dark:border-navy-900 animate-pulse" />
            )}
          </div>
        ))}
        {activeUsers.length > 5 && (
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-navy-700 border-2 border-white dark:border-navy-900 flex items-center justify-center text-[7px] font-bold text-slate-500">
            +{activeUsers.length - 5}
          </div>
        )}
      </div>
      <span className="text-[9px] text-slate-400 ml-1">
        {activeUsers.length} {isPl ? 'online' : 'online'}
      </span>
    </div>
  );
};

/**
 * CellCursor — Shows a colored border around cells being edited by other users.
 */
export const CellCursor: React.FC<{
  remoteUsers: PresenceUser[];
  nodeId: string;
  colKey: string;
}> = ({ remoteUsers, nodeId, colKey }) => {
  const editing = remoteUsers.find(
    (u) => u.activeCell?.nodeId === nodeId && u.activeCell?.colKey === colKey
  );
  if (!editing) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 rounded"
      style={{ boxShadow: `inset 0 0 0 2px ${editing.color}` }}
    >
      <div
        className="absolute -top-4 left-0 px-1 py-0.5 rounded text-[7px] font-bold text-white whitespace-nowrap"
        style={{ backgroundColor: editing.color }}
      >
        {editing.name}
      </div>
    </div>
  );
};

export default CollaborationPresence;
