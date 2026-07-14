/**
 * NotebookPresenceStack — #23 live presence avatars for a notebook page.
 *
 * Visual + behavioural mirror of DeckPresenceStack, fed by useNotebookPresence
 * (/ws/notebook/:noteId). Renders an avatar stack of the OTHER users viewing
 * this note plus a "N osób tu teraz" label.
 *
 * Fail-open by construction: when nobody else is present (solo / disconnected)
 * `others` is empty and this renders nothing — the notebook is unaffected.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface PresenceUserLite {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
}

interface NotebookPresenceStackProps {
  users: PresenceUserLite[];
  localUserId?: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isPolish: boolean;
  max?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const NotebookPresenceStack: React.FC<NotebookPresenceStackProps> = ({
  users,
  localUserId,
  connectionStatus,
  isPolish,
  max = 4,
}) => {
  const { t } = useTranslation();
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
  const label = t('notebook.presenceStack.viewingNow', '{{count}} viewing now', {
    count: others.length,
    unit: others.length === 1 ? 'osoba' : 'osoby',
  });

  return (
    <div className="flex items-center gap-2" data-testid="notebook-presence-stack" title={label}>
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-c-success' : 'bg-c-border'
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
            data-testid={`notebook-presence-avatar-${u.userId}`}
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
      <span className="text-[11px] text-c-text-muted whitespace-nowrap">{label}</span>
    </div>
  );
};

export default NotebookPresenceStack;
