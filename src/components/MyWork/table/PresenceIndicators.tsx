/**
 * Presence indicator components for Table Platform real-time collaboration.
 * Shows avatar bubbles for users viewing the same table, and per-cell cursor highlights.
 */

import React from 'react';

interface PresenceInfo {
  userId: string;
  userName: string;
  color: string;
  recordId?: string;
  fieldId?: string;
}

interface PresenceIndicatorsProps {
  presence: PresenceInfo[];
  currentUserId: string;
}

export const PresenceIndicators: React.FC<PresenceIndicatorsProps> = ({ presence, currentUserId }) => {
  const others = presence.filter((p) => p.userId !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2">
      {others.slice(0, 5).map((p) => (
        <div
          key={p.userId}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
          style={{ backgroundColor: p.color }}
          title={p.userName}
        >
          {p.userName.charAt(0).toUpperCase()}
        </div>
      ))}
      {others.length > 5 && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-gray-400 text-white">
          +{others.length - 5}
        </div>
      )}
    </div>
  );
};

interface CellPresenceProps {
  recordId: string;
  fieldId: string;
  presence: PresenceInfo[];
  currentUserId: string;
}

export const CellPresenceIndicator: React.FC<CellPresenceProps> = ({
  recordId,
  fieldId,
  presence,
  currentUserId,
}) => {
  const editing = presence.find(
    (p) => p.userId !== currentUserId && p.recordId === recordId && p.fieldId === fieldId,
  );
  if (!editing) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none border-2 rounded"
      style={{ borderColor: editing.color }}
    >
      <span
        className="absolute -top-5 left-0 text-[10px] px-1 rounded text-white whitespace-nowrap"
        style={{ backgroundColor: editing.color }}
      >
        {editing.userName}
      </span>
    </div>
  );
};
