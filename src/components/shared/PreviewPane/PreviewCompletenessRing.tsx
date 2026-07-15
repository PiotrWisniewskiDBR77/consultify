import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PreviewCompletenessRingProps {
  percent: number;
  missingFields?: string[];
  /** Click handler — e.g. open full view focused on first missing field */
  onClick?: () => void;
  size?: number;
}

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ringColor(pct: number): string {
  if (pct >= 80) return 'stroke-emerald-500';
  if (pct >= 50) return 'stroke-amber-500';
  return 'stroke-danger-500';
}

export const PreviewCompletenessRing: React.FC<PreviewCompletenessRingProps> = ({
  percent,
  missingFields,
  onClick,
  size = 22,
}) => {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className="relative inline-flex items-center gap-1 cursor-default"
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg width={size} height={size} viewBox="0 0 20 20" className="rotate-[-90deg]">
        <circle
          cx="10"
          cy="10"
          r={RADIUS}
          fill="none"
          strokeWidth="2.5"
          className="stroke-slate-200/60 dark:stroke-white/[0.06]"
        />
        <circle
          cx="10"
          cy="10"
          r={RADIUS}
          fill="none"
          strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${ringColor(percent)} transition-[stroke-dashoffset] duration-500`}
        />
      </svg>
      <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
        {Math.round(percent)}%
      </span>

      {showTooltip && missingFields && missingFields.length > 0 ? (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-w-[220px] rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg p-2">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t('sharedComponents.previewCompletenessRing.missingFields')}
          </div>
          <ul className="space-y-0.5">
            {missingFields.map((field) => (
              <li
                key={field}
                className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1"
              >
                <span className="w-1 h-1 rounded-full bg-danger-400 shrink-0" />
                {field}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Tag>
  );
};

export default PreviewCompletenessRing;
