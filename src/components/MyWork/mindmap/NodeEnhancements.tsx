/**
 * NodeEnhancements — Visual enhancements for mind map nodes:
 * - Evidence badges (cross-reference with company data)
 * - Maturity progress ring
 * - Status indicator
 * - Glow effects
 */
import React from 'react';

// ── Evidence Badge ──────────────────────────────────────────────────────────

export type EvidenceType = 'assessment' | 'interview' | 'kpi';

interface EvidenceBadgeProps {
  type: EvidenceType;
  count: number;
  compact?: boolean;
}

const EVIDENCE_CONFIG: Record<EvidenceType, { color: string; letter: string }> = {
  assessment: { color: 'bg-rose-500', letter: 'A' },
  interview: { color: 'bg-blue-500', letter: 'I' },
  kpi: { color: 'bg-emerald-500', letter: 'K' },
};

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({ type, count, compact }) => {
  const cfg = EVIDENCE_CONFIG[type];
  if (count === 0) return null;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full text-white font-bold ${cfg.color} ${
        compact ? 'w-3.5 h-3.5 text-[6px]' : 'w-4 h-4 text-[7px]'
      }`}
      title={`${type}: ${count}`}
    >
      {compact ? cfg.letter : count}
    </div>
  );
};

// ── Maturity Progress Ring ──────────────────────────────────────────────────

interface MaturityRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

export const MaturityRing: React.FC<MaturityRingProps> = ({
  score,
  size = 20,
  strokeWidth = 2.5,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : score >= 25 ? '#fb923c' : '#94a3b8';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-200 dark:text-navy-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
};

// ── Status Dot ──────────────────────────────────────────────────────────────

export type NodeStatusType = 'idea' | 'exploring' | 'validated' | 'ready_to_convert' | 'converted';

interface StatusDotProps {
  status: NodeStatusType;
  size?: number;
}

const STATUS_COLORS: Record<NodeStatusType, string> = {
  idea: 'bg-slate-400',
  exploring: 'bg-blue-500',
  validated: 'bg-emerald-500',
  ready_to_convert: 'bg-amber-500',
  converted: 'bg-primary-500',
};

export const StatusDot: React.FC<StatusDotProps> = ({ status, size = 6 }) => (
  <div
    className={`rounded-full ${STATUS_COLORS[status]} ring-2 ring-white dark:ring-navy-900`}
    style={{ width: size, height: size }}
    title={status.replace(/_/g, ' ')}
  />
);

// ── Glow Effect ─────────────────────────────────────────────────────────────

interface GlowWrapperProps {
  children: React.ReactNode;
  isNew?: boolean;
  isAI?: boolean;
  className?: string;
}

export const GlowWrapper: React.FC<GlowWrapperProps> = ({
  children,
  isNew,
  isAI,
  className = '',
}) => {
  if (!isNew && !isAI) return <>{children}</>;

  const glowColor = isAI
    ? 'shadow-[0_0_15px_rgba(139,92,246,0.3)] dark:shadow-[0_0_20px_rgba(139,92,246,0.4)]'
    : 'shadow-[0_0_12px_rgba(251,191,36,0.3)] dark:shadow-[0_0_16px_rgba(251,191,36,0.4)]';

  return (
    <div
      className={`rounded-xl ${glowColor} ${className}`}
      style={isNew ? { animation: 'idea-node-glow 3s ease-out forwards' } : undefined}
    >
      {children}
    </div>
  );
};

// ── Vote Stars ──────────────────────────────────────────────────────────────

interface VoteStarsProps {
  votes: number;
  maxVotes?: number;
  onVote?: (newVotes: number) => void;
  compact?: boolean;
  disabled?: boolean;
}

export const VoteStars: React.FC<VoteStarsProps> = ({
  votes,
  maxVotes = 5,
  onVote,
  compact,
  disabled,
}) => {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxVotes }, (_, i) => (
        <button
          key={i}
          onClick={() => onVote?.(i + 1 === votes ? 0 : i + 1)}
          disabled={disabled || !onVote}
          className={`transition-colors ${
            i < votes ? 'text-amber-400' : 'text-slate-300 dark:text-navy-600 hover:text-amber-300'
          } disabled:cursor-default`}
        >
          <svg
            width={compact ? 8 : 10}
            height={compact ? 8 : 10}
            viewBox="0 0 24 24"
            fill={i < votes ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
};
