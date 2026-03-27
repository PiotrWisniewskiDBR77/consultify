/**
 * CollaborationPresence — Real-time presence indicators for the Idea Table.
 *
 * Shows: avatar bubbles of active collaborators, colored cell cursors,
 * "typing…" indicators, and a presence bar at the top.
 * Uses SSE/polling to sync presence state.
 */
import { Lock, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type V8MultiplayerLockRecord,
  type V8MultiplayerSurfacePresence,
  V8MultiplayerApi,
} from '@/services/api/v8/multiplayer';

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
  renderIndicator?: boolean;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
}

interface WorkspacePresenceIndicatorProps {
  workspaceId?: string | null;
  currentUserId?: string | null;
  enabled?: boolean;
}

interface WorkspaceLockIndicatorProps {
  workspaceId?: string | null;
  currentUserId?: string | null;
  enabled?: boolean;
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

function getPresenceColor(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function mapWorkspacePresenceUsers(
  presence: V8MultiplayerSurfacePresence[],
  currentUserId?: string | null
): PresenceUser[] {
  const now = Date.now();
  const deduped = new Map<string, V8MultiplayerSurfacePresence>();

  for (const row of presence) {
    if (!row.userId || row.userId === currentUserId) continue;
    const lastSeen = Date.parse(row.lastHeartbeat);
    if (Number.isNaN(lastSeen) || now - lastSeen >= STALE_THRESHOLD_MS) continue;

    const existing = deduped.get(row.userId);
    const existingLastSeen = existing ? Date.parse(existing.lastHeartbeat) : 0;
    if (!existing || lastSeen > existingLastSeen) {
      deduped.set(row.userId, row);
    }
  }

  return Array.from(deduped.values()).map((row) => ({
    id: row.userId,
    name: row.userId,
    color: getPresenceColor(row.userId),
    lastSeen: Date.parse(row.lastHeartbeat),
    isTyping: row.presenceType === 'typing',
  }));
}

function isLockActive(lock: V8MultiplayerLockRecord): boolean {
  if (lock.releasedAt) return false;
  const acquiredAt = Date.parse(lock.acquiredAt);
  if (Number.isNaN(acquiredAt)) return false;
  return acquiredAt + lock.ttl > Date.now();
}

function formatLockTypeLabel(lockType: V8MultiplayerLockRecord['lockType'], isPl: boolean): string {
  switch (lockType) {
    case 'optimistic_row':
      return isPl ? 'Wiersz' : 'Row';
    case 'optimistic_section':
      return isPl ? 'Sekcja' : 'Section';
    case 'exclusive_schema':
      return isPl ? 'Schema' : 'Schema';
    case 'exclusive_document':
      return isPl ? 'Document' : 'Document';
    case 'phase_lock':
      return isPl ? 'Phase' : 'Phase';
    case 'advisory_object':
    default:
      return isPl ? 'Object' : 'Object';
  }
}

function summarizeLockScope(lockScope: string): string {
  const parts = lockScope.split(':').filter(Boolean);
  if (parts.length === 0) return lockScope;
  return parts[parts.length - 1];
}

function mapWorkspaceLocks(
  locks: V8MultiplayerLockRecord[],
  currentUserId?: string | null
): V8MultiplayerLockRecord[] {
  return locks.filter((lock) => lock.holderId !== currentUserId && isLockActive(lock));
}

async function resolveWorkspaceRoomId(workspaceId: string): Promise<string | null> {
  const binding = await V8MultiplayerApi.getRoomBinding('workspace', workspaceId);
  return binding.binding?.roomResourceId ?? null;
}

export const WorkspacePresenceIndicator: React.FC<WorkspacePresenceIndicatorProps> = ({
  workspaceId,
  currentUserId,
  enabled = true,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorkspacePresence = useCallback(async () => {
    if (!enabled || !workspaceId) {
      setActiveUsers([]);
      return;
    }

    try {
      const roomId = await resolveWorkspaceRoomId(workspaceId);
      if (!roomId) {
        setActiveUsers([]);
        return;
      }

      const response = await V8MultiplayerApi.getRoomPresence(roomId);
      setActiveUsers(mapWorkspacePresenceUsers(response.presence || [], currentUserId));
    } catch {
      setActiveUsers([]);
    }
  }, [currentUserId, enabled, workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    fetchWorkspacePresence();
    pollRef.current = setInterval(fetchWorkspacePresence, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, fetchWorkspacePresence, workspaceId]);

  if (!enabled || activeUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2" aria-label={isPl ? 'Obecni we workspace' : 'Workspace presence'}>
      <Users size={11} className="text-sky-500" />
      <div className="flex items-center -space-x-1.5">
        {activeUsers.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className="relative"
            title={`${user.id}${user.isTyping ? (isPl ? ' (pisze…)' : ' (typing…)') : ''}`}
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center text-[7px] font-black text-white"
              style={{ backgroundColor: user.color }}
            >
              {getInitials(user.name)}
            </div>
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
      <span className="text-[9px] text-sky-600 dark:text-sky-300 ml-1">
        {activeUsers.length} {isPl ? 'online' : 'online'}
      </span>
    </div>
  );
};

export const WorkspaceLockIndicator: React.FC<WorkspaceLockIndicatorProps> = ({
  workspaceId,
  currentUserId,
  enabled = true,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [activeLocks, setActiveLocks] = useState<V8MultiplayerLockRecord[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorkspaceLocks = useCallback(async () => {
    if (!enabled || !workspaceId) {
      setActiveLocks([]);
      return;
    }

    try {
      const roomId = await resolveWorkspaceRoomId(workspaceId);
      if (!roomId) {
        setActiveLocks([]);
        return;
      }

      const response = await V8MultiplayerApi.getRoomLocks(roomId);
      setActiveLocks(mapWorkspaceLocks(response.locks || [], currentUserId));
    } catch {
      setActiveLocks([]);
    }
  }, [currentUserId, enabled, workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    fetchWorkspaceLocks();
    pollRef.current = setInterval(fetchWorkspaceLocks, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, fetchWorkspaceLocks, workspaceId]);

  if (!enabled || activeLocks.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2" aria-label={isPl ? 'Blokady we workspace' : 'Workspace locks'}>
      <Lock size={11} className="text-amber-500" />
      <span className="text-[9px] text-amber-700 dark:text-amber-300">
        {activeLocks.length} {isPl ? 'blocked' : 'locked'}
      </span>
      <div className="hidden md:flex items-center gap-1">
        {activeLocks.slice(0, 2).map((lock) => (
          <span
            key={lock.lockId}
            className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            title={`${lock.holderId} • ${formatLockTypeLabel(lock.lockType, isPl)} • ${lock.lockScope}`}
          >
            {formatLockTypeLabel(lock.lockType, isPl)}: {summarizeLockScope(lock.lockScope)}
          </span>
        ))}
        {activeLocks.length > 2 && (
          <span className="text-[9px] text-amber-700 dark:text-amber-300">
            +{activeLocks.length - 2}
          </span>
        )}
      </div>
    </div>
  );
};

export const CollaborationPresence: React.FC<CollaborationPresenceProps> = ({
  ideaId,
  currentUserId,
  currentUserName,
  enabled = true,
  renderIndicator = true,
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

  if (!enabled || !renderIndicator || activeUsers.length === 0) return null;

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
