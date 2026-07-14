/**
 * DeckPresenceStack — P3.3 live presence indicator for the Deck Builder.
 *
 * Renders an avatar stack of the users currently viewing/editing this deck,
 * backed by the /ws/presentations/:deckId gateway (via useCollaboration).
 *
 * Fail-open by construction: if the WS never connects (no token, gateway down,
 * flag off) `connectedUsers` stays empty and this renders nothing — the editor
 * is unaffected. Only mounted when VITE_ENABLE_DECK_COLLABORATE is on.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface PresenceUserLite {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
}

interface DeckPresenceStackProps {
  users: PresenceUserLite[];
  localUserId?: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  max?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const DeckPresenceStack: React.FC<DeckPresenceStackProps> = ({
  users,
  localUserId,
  connectionStatus,
  max = 4,
}) => {
  const { t } = useTranslation();

  // Show remote users first (the local user's own avatar is redundant here),
  // but keep the local user if they're the only one so the dot still reads
  // "connected". Dedupe defensively.
  const seen = new Set<string>();
  const roster = users.filter((u) => {
    if (seen.has(u.userId)) return false;
    seen.add(u.userId);
    return true;
  });
  const others = roster.filter((u) => u.userId !== localUserId);

  // Nothing to show when solo / disconnected — fail-open: render nothing.
  if (others.length === 0) return null;

  const visible = others.slice(0, max);
  const overflow = others.length - visible.length;

  return (
    <div
      className="flex items-center gap-2"
      data-testid="deck-presence-stack"
      title={t('presentations.builder.presence.hereNow', {
        count: others.length,
        defaultValue: '{{count}} here now',
      })}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' : 'bg-c-border'
        }`}
        aria-hidden
      />
      <div className="flex -space-x-2">
        {visible.map((u) => (
          <div
            key={u.userId}
            className="relative w-7 h-7 rounded-full ring-2 ring-c-surface flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden"
            style={{ backgroundColor: u.color }}
            title={u.name}
            data-testid={`deck-presence-avatar-${u.userId}`}
          >
            {u.avatarUrl ? (
              <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
            ) : (
              initials(u.name)
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="relative w-7 h-7 rounded-full ring-2 ring-c-surface bg-c-surface-raised flex items-center justify-center text-[10px] font-semibold text-c-text-secondary">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
};
