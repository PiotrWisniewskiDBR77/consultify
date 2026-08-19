/**
 * CollaborationPresence — Real-time presence indicators for the Idea Table.
 *
 * Shows: avatar bubbles of active collaborators, colored cell cursors,
 * "typing…" indicators, and a presence bar at the top.
 * Uses SSE/polling to sync presence state.
 */
import type { TFunction } from 'i18next';
import { Lock, Users, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  V8MultiplayerApi,
  type V8MultiplayerLockRecord,
  type V8MultiplayerSurfacePresence,
} from '@/services/api/v8/multiplayer';
import { ideaTablePresenceErrorMessage } from '@/utils/mywork/ideaTablePresenceErrorMessage';

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

// Categorical identity palette — maps to the app c-tag-* token layer (light/dark aware).
const PRESENCE_COLORS = [
  'var(--c-tag-1)',
  'var(--c-tag-2)',
  'var(--c-tag-3)',
  'var(--c-tag-4)',
  'var(--c-tag-5)',
  'var(--c-tag-6)',
  'var(--c-tag-7)',
  'var(--c-tag-8)',
  'var(--c-tag-9)',
  'var(--c-tag-10)',
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

function formatLockTypeLabel(lockType: V8MultiplayerLockRecord['lockType'], t: TFunction): string {
  switch (lockType) {
    case 'optimistic_row':
      return t('myWorkTable.collaborationPresence.lockTypeRow');
    case 'optimistic_section':
      return t('myWorkTable.collaborationPresence.lockTypeSection');
    case 'exclusive_schema':
      return t('myWorkTable.collaborationPresence.lockTypeSchema');
    case 'exclusive_document':
      return t('myWorkTable.collaborationPresence.lockTypeDocument');
    case 'phase_lock':
      return t('myWorkTable.collaborationPresence.lockTypePhase');
    case 'advisory_object':
    default:
      return t('myWorkTable.collaborationPresence.lockTypeObject');
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
  const { t } = useTranslation();
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [presenceStatus, setPresenceStatus] = useState<'healthy' | 'degraded'>('healthy');
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
      setPresenceStatus('healthy');
    } catch {
      setActiveUsers([]);
      setPresenceStatus('degraded');
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

  if (!enabled || (activeUsers.length === 0 && presenceStatus !== 'degraded')) return null;

  return (
    <div
      className="flex items-center gap-1 px-2"
      aria-label={t('myWorkTable.collaborationPresence.workspacePresence')}
    >
      {presenceStatus === 'degraded' ? (
        <>
          <WifiOff size={11} className="text-amber-500" />
          <span className="text-[9px] text-amber-900 dark:text-amber-200">
            {t('myWorkTable.collaborationPresence.workspacePresenceUnavailable')}
          </span>
        </>
      ) : (
        <>
          <Users size={11} className="text-sky-500" />
          <div className="flex items-center -space-x-1.5">
            {activeUsers.slice(0, 5).map((user) => (
              <div
                key={user.id}
                className="relative"
                title={`${user.id}${user.isTyping ? ` (${t('myWorkTable.collaborationPresence.typing')})` : ''}`}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 border-c-border-subtle flex items-center justify-center text-[7px] font-black text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {getInitials(user.name)}
                </div>
                {user.isTyping && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-c-border-subtle animate-pulse" />
                )}
              </div>
            ))}
            {activeUsers.length > 5 && (
              <div className="w-5 h-5 rounded-full bg-c-border-subtle border-2 border-c-border-subtle flex items-center justify-center text-[7px] font-bold text-c-text-muted">
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
          <span className="text-[9px] text-sky-600 dark:text-sky-300 ml-1">
            {activeUsers.length} {t('myWorkTable.collaborationPresence.online')}
          </span>
        </>
      )}
    </div>
  );
};

export const WorkspaceLockIndicator: React.FC<WorkspaceLockIndicatorProps> = ({
  workspaceId,
  currentUserId,
  enabled = true,
}) => {
  const { t } = useTranslation();
  const [activeLocks, setActiveLocks] = useState<V8MultiplayerLockRecord[]>([]);
  const [lockStatus, setLockStatus] = useState<'healthy' | 'degraded'>('healthy');
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
      setLockStatus('healthy');
    } catch {
      setActiveLocks([]);
      setLockStatus('degraded');
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

  if (!enabled || (activeLocks.length === 0 && lockStatus !== 'degraded')) return null;

  return (
    <div
      className="flex items-center gap-1 px-2"
      aria-label={t('myWorkTable.collaborationPresence.workspaceLocks')}
    >
      {lockStatus === 'degraded' ? (
        <>
          <WifiOff size={11} className="text-amber-500" />
          <span className="text-[9px] text-amber-900 dark:text-amber-200">
            {t('myWorkTable.collaborationPresence.workspaceLocksUnavailable')}
          </span>
        </>
      ) : (
        <>
          <Lock size={11} className="text-amber-500" />
          <span className="text-[9px] text-amber-900 dark:text-amber-200">
            {activeLocks.length} {t('myWorkTable.collaborationPresence.locked')}
          </span>
          <div className="hidden md:flex items-center gap-1">
            {activeLocks.slice(0, 2).map((lock) => (
              <span
                key={lock.lockId}
                className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                title={`${lock.holderId} • ${formatLockTypeLabel(lock.lockType, t)} • ${lock.lockScope}`}
              >
                {formatLockTypeLabel(lock.lockType, t)}: {summarizeLockScope(lock.lockScope)}
              </span>
            ))}
            {activeLocks.length > 2 && (
              <span className="text-[9px] text-amber-900 dark:text-amber-200">
                +{activeLocks.length - 2}
              </span>
            )}
          </div>
        </>
      )}
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
  const { t } = useTranslation();
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([]);
  const [presenceStatus, setPresenceStatus] = useState<'healthy' | 'degraded'>('healthy');
  const [presenceDegradedMessage, setPresenceDegradedMessage] = useState<string>('');
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
        await Api.broadcastIdeaPresence(ideaId, {
          userId: currentUserId,
          userName: currentUserName,
          color: myColor,
          activeCell,
          timestamp: Date.now(),
        });
      } catch (error) {
        setPresenceStatus('degraded');
        setRemoteUsers([]);
        onPresenceUpdate?.([]);
        const fallback = t('myWorkTable.collaborationPresence.cursorPublishFailed');
        setPresenceDegradedMessage(ideaTablePresenceErrorMessage(error, fallback));
      }
    },
    [currentUserId, currentUserName, enabled, ideaId, myColor, onPresenceUpdate, t]
  );

  const fetchPresence = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await Api.getIdeaPresence(ideaId);
      if (Array.isArray(result?.users)) {
        const now = Date.now();
        const active = (result.users as PresenceUser[]).filter(
          (u) => u.id !== currentUserId && now - u.lastSeen < STALE_THRESHOLD_MS
        );
        setRemoteUsers(active);
        onPresenceUpdate?.(active);
        setPresenceStatus('healthy');
        setPresenceDegradedMessage('');
      } else {
        setRemoteUsers([]);
        onPresenceUpdate?.([]);
        setPresenceStatus('healthy');
        setPresenceDegradedMessage('');
      }
    } catch (error) {
      setRemoteUsers([]);
      onPresenceUpdate?.([]);
      setPresenceStatus('degraded');
      const fallback = t('myWorkTable.collaborationPresence.ideaTablePresenceUnavailable');
      setPresenceDegradedMessage(ideaTablePresenceErrorMessage(error, fallback));
    }
  }, [currentUserId, enabled, ideaId, onPresenceUpdate, t]);

  // Najswiezsze wersje callbackow trzymamy w refach, zeby efekt ponizej NIE
  // zalezal od ich tozsamosci.
  const broadcastRef = useRef(broadcastPresence);
  const fetchRef = useRef(fetchPresence);
  broadcastRef.current = broadcastPresence;
  fetchRef.current = fetchPresence;

  // Sprzezenie zwrotne, ktore tu bylo: rodzic podaje `onPresenceUpdate` jako
  // funkcje inline (nowa referencja przy KAZDYM renderze) → nowy
  // broadcastPresence/fetchPresence → efekt sie restartuje → czysci interwal i
  // NATYCHMIAST wysyla POST /presence → odpowiedz ustawia stan rodzica → render
  // → od poczatku. Interwal 5 s nigdy nie zdazyl wystrzelic, a pomiar w runtime
  // pokazal 156-880 POST-ow na kilkanascie sekund (~55/s).
  // Efekt zalezy teraz WYLACZNIE od tozsamosci sesji (`ideaId`) i wlacznika.
  useEffect(() => {
    if (!enabled) return;
    broadcastRef.current();
    fetchRef.current();
    pollRef.current = setInterval(() => {
      broadcastRef.current();
      fetchRef.current();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, ideaId]);

  const activeUsers = remoteUsers.filter((u) => Date.now() - u.lastSeen < STALE_THRESHOLD_MS);

  if (!enabled || !renderIndicator || (activeUsers.length === 0 && presenceStatus !== 'degraded')) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 px-2">
      {presenceStatus === 'degraded' && (
        <>
          <WifiOff size={11} className="text-amber-500" />
          <span className="text-[9px] text-amber-900 dark:text-amber-200">
            {presenceDegradedMessage ||
              t('myWorkTable.collaborationPresence.ideaTablePresenceUnavailable')}
          </span>
        </>
      )}
      {presenceStatus !== 'degraded' && (
        <>
          <Users size={11} className="text-c-text-secondary" />
          <div className="flex items-center -space-x-1.5">
            {activeUsers.slice(0, 5).map((user) => (
              <div
                key={user.id}
                className="relative group"
                title={`${user.name}${user.isTyping ? ` (${t('myWorkTable.collaborationPresence.typing')})` : ''}`}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-5 h-5 rounded-full border-2 border-c-border-subtle"
                    style={{ borderColor: user.color }}
                  />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full border-2 border-c-border-subtle flex items-center justify-center text-[7px] font-black text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {getInitials(user.name)}
                  </div>
                )}
                {user.isTyping && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-c-border-subtle animate-pulse" />
                )}
              </div>
            ))}
            {activeUsers.length > 5 && (
              <div className="w-5 h-5 rounded-full bg-c-border-subtle border-2 border-c-border-subtle flex items-center justify-center text-[7px] font-bold text-c-text-muted">
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
          <span className="text-[9px] text-c-text-secondary ml-1">
            {activeUsers.length} {t('myWorkTable.collaborationPresence.online')}
          </span>
        </>
      )}
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

  const accessibleLabel = `${editing.name} is editing this cell`;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 rounded"
      style={{ boxShadow: `inset 0 0 0 2px ${editing.color}` }}
      role="status"
      aria-label={accessibleLabel}
      data-testid={`cell-cursor-${nodeId}-${colKey}`}
    >
      <div
        className="absolute -top-4 left-0 px-1 py-0.5 rounded text-[7px] font-bold text-white whitespace-nowrap"
        style={{ backgroundColor: editing.color }}
        data-testid={`cell-cursor-chip-${nodeId}-${colKey}`}
      >
        {editing.name}
      </div>
    </div>
  );
};

export default CollaborationPresence;
