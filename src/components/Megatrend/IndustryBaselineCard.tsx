// components/Megatrend/IndustryBaselineCard.tsx
// Card 1: Industry Baseline
// ---------------------------------------------------------------
// Shows the default megatrends for the selected industry.
// Controlled component that accepts industry prop.
// ---------------------------------------------------------------

import { ArrowRight, Globe, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import { MegatrendDetail } from './TrendDetailCard';

interface IndustryBaselineCardProps {
  industry: string;
  megatrends: MegatrendDetail[];
  loading?: boolean;
  error?: string | null;
  /** Refetch handler — renders a "Try again" button on the error state. */
  onRetry?: () => void;
  onTrendSelect: (trendId: string) => void;
}

export const IndustryBaselineCard: React.FC<IndustryBaselineCardProps> = ({
  industry,
  megatrends,
  loading,
  error,
  onRetry,
  onTrendSelect,
}) => {
  const { t } = useTranslation();
  const isEmpty = !loading && !error && megatrends.length === 0;
  return (
    <div className="space-y-6">
      <div className="bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)] p-4 rounded-lg flex items-start gap-3 border-l-2 border-c-info">
        <Sparkles className="text-c-info mt-1" size={18} />
        <div>
          <h4 className="font-bold text-c-text">
            Industry Standard Trends: {industry.charAt(0).toUpperCase() + industry.slice(1)}
          </h4>
          <p className="text-xs text-c-text-secondary mt-1">
            Below are the top megatrends affecting your industry globally. AI has prioritized these
            based on market signals and your context.
          </p>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-c-border-subtle dark:border-white/[0.08] bg-c-surface-raised dark:bg-c-surface/[0.04] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* A failed fetch used to reuse the EMPTY-state copy ("not yet configured
          — contact your admin"), which reports a transient network failure as a
          permanent configuration gap and offers no way out. A failure is a
          failure: say so, and offer the retry. */}
      {error && (
        <EmptyState
          variant="error"
          title={t('tools.megatrends.loadFailed', 'Could not load megatrends')}
          description={t(
            'tools.megatrends.loadFailedDesc',
            'The megatrend baseline for this industry could not be fetched.'
          )}
          onRetry={onRetry}
        />
      )}

      {isEmpty && (
        <div className="rounded-2xl border border-dashed border-c-border-subtle dark:border-white/[0.08] bg-c-surface-raised dark:bg-c-surface/[0.04] p-8 text-center">
          <Globe className="mx-auto mb-3 text-c-text-secondary" size={28} strokeWidth={1.5} />
          <p className="text-base font-medium text-c-text-secondary">
            {t('tools.megatrends.notAvailable', 'Megatrends data is not yet configured')}
          </p>
          <p className="mt-2 text-sm text-c-text-muted">
            {t('tools.megatrends.contactAdmin', 'Contact your admin')}
          </p>
        </div>
      )}

      {!loading && !error && megatrends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {megatrends.map((trend) => (
            <div
              key={trend.id}
              className="p-5 rounded-lg border border-c-border-subtle bg-c-surface-raised hover:shadow-lg hover:border-c-border-strong transition-all duration-200 group relative overflow-hidden"
            >
              {/* Accent Bar */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  trend.type === 'Technology'
                    ? 'bg-c-tag-1'
                    : trend.type === 'Business'
                      ? 'bg-c-tag-3'
                      : 'bg-c-tag-9'
                }`}
              ></div>

              <div className="flex justify-between items-start mb-2 pl-3">
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                    trend.type === 'Technology'
                      ? 'bg-c-tag-1 text-white'
                      : trend.type === 'Business'
                        ? 'bg-c-tag-3 text-white'
                        : 'bg-c-tag-9 text-white'
                  }`}
                >
                  {trend.type}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded ${
                    trend.impactScore >= 6
                      ? 'bg-c-danger text-white'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  Impact: {trend.impactScore}/7
                </span>
              </div>

              <h3 className="font-bold text-c-text text-lg pl-3 mb-2 group-hover:text-c-accent transition-colors">
                {trend.label}
              </h3>

              <p className="text-xs text-c-text-muted pl-3 mb-4 line-clamp-2">
                {trend.shortDescription}
              </p>

              <div
                className="pl-3 mt-auto flex items-center gap-2 text-xs font-bold text-c-accent hover:opacity-80 cursor-pointer"
                onClick={() => onTrendSelect(trend.id)}
              >
                See Strategic Impact{' '}
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
