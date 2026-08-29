/**
 * SourceTraceability — V4-DECK-01: Block-level traceability
 * Per-card footer with source chips, per-block subtle indicator.
 * Citation UI on hover/click.
 */

import { Database, ExternalLink, FileText, Target, TrendingUp, Zap } from 'lucide-react';
import React from 'react';

export interface SourceRef {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
}

export const SOURCE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  initiative: Target,
  financial_analysis: TrendingUp,
  report: FileText,
  tool_session: Zap,
  note: FileText,
};

interface CardSourceFooterProps {
  sourceRefs: SourceRef[];
  onClickSource?: (ref: SourceRef) => void;
}

export const CardSourceFooter: React.FC<CardSourceFooterProps> = ({
  sourceRefs,
  onClickSource,
}) => {
  if (sourceRefs.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 pt-2 mt-auto opacity-60 hover:opacity-100 transition-opacity">
      <Database size={9} className="text-c-text-secondary flex-shrink-0" />
      <div className="flex flex-wrap gap-1">
        {sourceRefs.map((ref) => {
          const Icon = SOURCE_ICONS[ref.artifact_type] || FileText;
          return (
            <div key={ref.artifact_id} className="relative group/chip">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClickSource?.(ref);
                }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-c-surface-raised hover:bg-blue-500/10 text-[8px] text-c-text-secondary hover:text-blue-600 transition-colors"
                title={`${ref.artifact_type}: ${ref.artifact_name}`}
              >
                <Icon size={8} />
                <span className="max-w-[80px] truncate">{ref.artifact_name}</span>
                <ExternalLink size={7} className="opacity-0 group-hover/chip:opacity-100" />
              </button>
              {/* V4-DECK-01: Hover citation tooltip */}
              <div className="absolute bottom-full left-0 mb-0.5 hidden group-hover/chip:block z-50 pointer-events-none">
                <div className="px-2 py-1 rounded bg-c-surface text-c-text text-[9px] shadow-lg whitespace-nowrap">
                  <span className="font-medium">{ref.artifact_type}</span>: {ref.artifact_name}
                  <div className="text-c-text-secondary text-[8px] mt-0.5">Kliknij, aby przejść</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface BlockSourceBadgeProps {
  sourceRef?: { artifact_id: string; artifact_type: string; artifact_name: string };
  isRefreshable: boolean;
}

export const BlockSourceBadge: React.FC<BlockSourceBadgeProps> = ({ sourceRef, isRefreshable }) => {
  if (!sourceRef) return null;

  return (
    <div className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/10 text-[7px] text-blue-500 font-medium">
        {isRefreshable && <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />}
        {sourceRef.artifact_name}
      </span>
    </div>
  );
};
