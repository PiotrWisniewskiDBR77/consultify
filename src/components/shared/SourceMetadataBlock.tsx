/**
 * SourceMetadataBlock (V3-A01)
 * Shows source info in detail views (properties strip area).
 * DBR77: subtle border, rounded-lg, bg-navy-800; color-coded badges.
 */

import { AlertTriangle, ExternalLink, Link2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { SourceType, TraceabilityMetadata } from '@/types/domain/traceability';

export interface SourceMetadataBlockProps {
  source: TraceabilityMetadata | null;
  /** Artifact type for analytics (e.g. initiative, report, presentation) */
  artifactType?: string;
  onOpenSource?: () => void;
  compact?: boolean;
}

const BADGE_STYLES: Record<SourceType, string> = {
  tool_session: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  mywork: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  assessment: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  financial_analysis: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  interview: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  manual: 'bg-slate-500/20 text-slate-600 border-slate-500/30',
};

function resolveSourceRoute(sourceType: SourceType, sourceId: string): string | null {
  switch (sourceType) {
    case 'tool_session':
    case 'mywork':
      return `/discovery-tools?docId=${encodeURIComponent(sourceId)}`;
    case 'assessment':
      return `/assessment/drd/${encodeURIComponent(sourceId)}`;
    case 'interview':
      return `/interview/${encodeURIComponent(sourceId)}/session`;
    case 'financial_analysis':
      return `/benefits?analysis=${encodeURIComponent(sourceId)}`;
    case 'manual':
    default:
      return null;
  }
}

export const SourceMetadataBlock: React.FC<SourceMetadataBlockProps> = ({
  source,
  artifactType = 'artifact',
  onOpenSource,
  compact = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleOpenSource = () => {
    if (onOpenSource) {
      onOpenSource();
    } else if (source) {
      const route = resolveSourceRoute(source.sourceType, source.sourceId);
      if (route) {
        trackFunnelEvent('artifact_source_opened', {
          type: artifactType,
          source_type: source.sourceType,
        });
        navigate(route);
      }
    }
  };

  if (!source) {
    return (
      <div
        className={`rounded-lg border border-danger-500/30 bg-danger-500/10 ${
          compact ? 'px-2 py-1' : 'px-3 py-2'
        }`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={compact ? 14 : 16} className="text-danger-400 shrink-0" />
          <span className="text-xs font-medium text-danger-400">
            {t('traceability.noSource', 'No source')}
          </span>
        </div>
      </div>
    );
  }

  const badgeStyle = BADGE_STYLES[source.sourceType] ?? BADGE_STYLES.manual;
  const route = resolveSourceRoute(source.sourceType, source.sourceId);
  const canOpen = !!route || !!onOpenSource;

  return (
    <div
      className={`rounded-lg border border-slate-700/50 bg-slate-800/80 dark:bg-[#151e32] ${
        compact ? 'px-2 py-1' : 'px-3 py-2'
      }`}
    >
      <div className={`flex items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
        <span className="text-xs text-slate-600 shrink-0">
          {t('traceability.source', 'Source')}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeStyle}`}
        >
          {t(`traceability.sourceType.${source.sourceType}`, source.sourceType)}
        </span>
        {source.sourceTitle && (
          <span
            className={`truncate text-slate-600 ${compact ? 'max-w-[120px]' : 'max-w-[200px]'}`}
            title={source.sourceTitle}
          >
            {source.sourceTitle}
          </span>
        )}
        {canOpen && (
          <button
            type="button"
            onClick={handleOpenSource}
            className="ml-auto flex items-center gap-1 text-primary-400 hover:underline shrink-0"
          >
            {compact ? (
              <ExternalLink size={14} />
            ) : (
              <>
                <Link2 size={14} />
                {t('traceability.openSource', 'Open source')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default SourceMetadataBlock;
