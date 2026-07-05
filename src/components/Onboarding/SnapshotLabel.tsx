import { AlertCircle, Camera, Clock, Info } from 'lucide-react';
import React from 'react';

/**
 * SnapshotLabel — Phase E: Guided First Value
 *
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-E3: Snapshot = "point in time", not verdict
 * - Clearly communicates temporal nature
 * - Not a final recommendation
 */

interface SnapshotLabelProps {
  timestamp?: string;
  version?: number;
  className?: string;
}

export const SnapshotLabel: React.FC<SnapshotLabelProps> = ({
  timestamp,
  version,
  className = '',
}) => {
  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
            bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)]
            border border-[color-mix(in_srgb,var(--c-warning)_30%,transparent)]
            ${className}
        `}
    >
      <Camera size={14} className="text-c-warning" />
      <span className="text-sm font-medium text-c-warning">
        Snapshot
        {version && ` v${version}`}
      </span>
      {formattedDate && (
        <>
          <span className="text-c-warning">•</span>
          <span className="text-xs text-c-warning">{formattedDate}</span>
        </>
      )}
    </div>
  );
};

/**
 * SnapshotDisclaimer — Full explanation of what a snapshot is
 */
export const SnapshotDisclaimer: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`
            bg-c-surface-raised dark:bg-c-surface 
            border border-c-border-subtle 
            rounded-lg p-4
            ${className}
        `}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)] flex items-center justify-center shrink-0">
          <AlertCircle size={16} className="text-c-warning" />
        </div>
        <div>
          <h4 className="font-semibold text-c-text text-sm mb-1">
            To jest snapshot — punkt w czasie
          </h4>
          <p className="text-sm text-c-text-secondary dark:text-c-text-muted mb-2">
            Ten widok przedstawia stan Twojego myślenia w momencie jego zapisania. To nie jest
            ostateczna rekomendacja ani werdykt.
          </p>
          <ul className="text-xs text-c-text-muted space-y-1">
            <li className="flex items-center gap-2">
              <Clock size={12} />
              <span>Możesz wrócić i zaktualizować w dowolnym momencie</span>
            </li>
            <li className="flex items-center gap-2">
              <Info size={12} />
              <span>Nowe informacje mogą zmienić percepcję</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * SnapshotBadge — Compact badge for lists
 */
export const SnapshotBadge: React.FC<{
  timestamp?: string;
  size?: 'sm' | 'md';
}> = ({ timestamp, size = 'sm' }) => {
  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })
    : 'Teraz';

  return (
    <span
      className={`
            inline-flex items-center gap-1 rounded-full
            bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)]
            text-c-warning
            ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
        `}
    >
      <Camera size={size === 'sm' ? 10 : 12} />
      <span>{formattedDate}</span>
    </span>
  );
};

export default SnapshotLabel;
