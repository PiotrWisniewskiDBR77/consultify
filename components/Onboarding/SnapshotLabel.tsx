import React from 'react';
import { Camera, Clock, AlertCircle, Info } from 'lucide-react';

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
        <div className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
            bg-amber-50 dark:bg-amber-900/20 
            border border-amber-200 dark:border-amber-500/30
            ${className}
        `}>
            <Camera size={14} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Snapshot
                {version && ` v${version}`}
            </span>
            {formattedDate && (
                <>
                    <span className="text-amber-400 dark:text-amber-600">•</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                        {formattedDate}
                    </span>
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
        <div className={`
            bg-slate-50 dark:bg-navy-900 
            border border-slate-200 dark:border-slate-700 
            rounded-lg p-4
            ${className}
        `}>
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                    <h4 className="font-semibold text-navy-900 dark:text-white text-sm mb-1">
                        To jest snapshot — punkt w czasie
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Ten widok przedstawia stan Twojego myślenia w momencie jego zapisania.
                        To nie jest ostateczna rekomendacja ani werdykt.
                    </p>
                    <ul className="text-xs text-slate-500 dark:text-slate-500 space-y-1">
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
        <span className={`
            inline-flex items-center gap-1 rounded-full
            bg-amber-100 dark:bg-amber-900/30 
            text-amber-700 dark:text-amber-400
            ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
        `}>
            <Camera size={size === 'sm' ? 10 : 12} />
            <span>{formattedDate}</span>
        </span>
    );
};

export default SnapshotLabel;
