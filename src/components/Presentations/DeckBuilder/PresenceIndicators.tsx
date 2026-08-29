/**
 * PresenceIndicators — shows connected collaborators' avatars in the top bar.
 * Includes live status dots, hover tooltips, and active card indicators.
 */

import { Users, Wifi, WifiOff } from 'lucide-react';
import React, { useState } from 'react';

interface CollabUser {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  activeCardIndex?: number;
  isOnline: boolean;
}

interface PresenceIndicatorsProps {
  users: CollabUser[];
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  maxAvatars?: number;
}

export const PresenceIndicators: React.FC<PresenceIndicatorsProps> = ({
  users,
  isConnected,
  connectionStatus,
  maxAvatars = 5,
}) => {
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);

  const displayUsers = users.slice(0, maxAvatars);
  const overflow = users.length - maxAvatars;

  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      <div
        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
          connectionStatus === 'connected'
            ? 'bg-green-50 text-green-600'
            : connectionStatus === 'connecting'
              ? 'bg-amber-50 text-amber-600'
              : connectionStatus === 'error'
                ? 'bg-danger-50 text-danger-600'
                : 'bg-c-surface-raised text-c-text-muted'
        }`}
      >
        {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
        {connectionStatus === 'connected' && users.length > 0 && <span>{users.length + 1}</span>}
      </div>

      {/* User avatars */}
      {users.length > 0 && (
        <div className="flex items-center -space-x-2">
          {displayUsers.map((user) => (
            <div
              key={user.userId}
              className="relative"
              onMouseEnter={() => setHoveredUser(user.userId)}
              onMouseLeave={() => setHoveredUser(null)}
            >
              <div
                className="w-7 h-7 rounded-full border-2 border-c-border-subtle flex items-center justify-center text-[10px] font-bold text-c-text shadow-sm"
                style={{ backgroundColor: user.color }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(user.name)
                )}
              </div>

              {/* Online indicator */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-c-border-subtle ${
                  user.isOnline ? 'bg-green-500' : 'bg-c-text-muted'
                }`}
              />

              {/* Active card number */}
              {user.activeCardIndex !== undefined && (
                <span
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center text-c-text"
                  style={{ backgroundColor: user.color }}
                >
                  {user.activeCardIndex + 1}
                </span>
              )}

              {/* Tooltip */}
              {hoveredUser === user.userId && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-c-surface text-c-text text-[10px] rounded shadow-lg whitespace-nowrap z-50">
                  {user.name}
                  {user.activeCardIndex !== undefined && (
                    <span className="text-c-text-muted"> · Slide {user.activeCardIndex + 1}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {overflow > 0 && (
            <div className="w-7 h-7 rounded-full border-2 border-c-border-subtle bg-c-border-subtle flex items-center justify-center text-[10px] font-medium text-c-text-secondary">
              +{overflow}
            </div>
          )}
        </div>
      )}

      {users.length === 0 && isConnected && (
        <div className="flex items-center gap-1 text-[10px] text-c-text-muted">
          <Users size={10} />
          <span>Tylko Ty</span>
        </div>
      )}
    </div>
  );
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
