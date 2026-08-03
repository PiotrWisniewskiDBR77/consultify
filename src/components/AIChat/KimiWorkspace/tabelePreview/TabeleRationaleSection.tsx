import { Brain, ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TabelePreviewRationale } from '@/types/tabeleArtifact';

interface TabeleRationaleSectionProps {
  rationale: TabelePreviewRationale;
  onOpenProposalQueue?: () => void;
}

const PROPOSAL_STYLES = {
  pending:
    'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
  approved:
    'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
  rejected:
    'border-danger-300/80 bg-danger-50 text-danger-900 dark:border-danger-300/[0.25] dark:bg-danger-300/[0.12] dark:text-danger-100',
  none: 'border-c-border-subtle bg-c-surface-raised text-c-text/[0.11]/[0.075]',
} as const;

export function TabeleRationaleSection({
  rationale,
  onOpenProposalQueue,
}: TabeleRationaleSectionProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const proposalStatus = rationale.proposalStatus ?? 'none';
  const visibleBullets = isExpanded ? rationale.bullets : rationale.bullets.slice(0, 6);
  const hasMoreBullets = rationale.bullets.length > 6;

  const proposalLabel =
    proposalStatus === 'pending'
      ? t('kimi.tabele.rationale.proposalPending', { defaultValue: 'Pending' })
      : proposalStatus === 'approved'
        ? t('kimi.tabele.rationale.proposalApproved', { defaultValue: 'Approved' })
        : proposalStatus === 'rejected'
          ? t('kimi.tabele.rationale.proposalRejected', { defaultValue: 'Rejected' })
          : t('kimi.tabele.rationale.proposalNone', { defaultValue: 'None' });

  return (
    <div className="rounded-hig-lg border border-c-border-subtle bg-c-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-hig-md bg-sky-50 p-2 text-sky-700 dark:bg-sky-300/[0.10] dark:text-sky-100">
          <Brain size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-c-text">
            {rationale.summary ||
              t('kimi.tabele.rationale.emptySummary', {
                defaultValue: 'No rationale summary was provided for this preview.',
              })}
          </p>

          {visibleBullets.length > 0 && (
            <ul
              className="mt-4 space-y-2"
              aria-label={t('kimi.tabele.rationale.points', { defaultValue: 'Rationale points' })}
            >
              {visibleBullets.map((bullet, index) => (
                <li key={`${bullet}-${index}`} className="flex gap-2 text-sm text-c-text">
                  <span
                    className="mt-2 h-1.5 w-1.5 rounded-hig-full bg-sky-500"
                    aria-hidden="true"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {hasMoreBullets && (
            <button
              type="button"
              onClick={() => setIsExpanded((value) => !value)}
              className="mt-3 text-xs font-medium text-c-text-secondary underline decoration-c-border underline-offset-4 hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isExpanded
                ? t('kimi.tabele.rationale.showLess', { defaultValue: 'Show less' })
                : t('kimi.tabele.rationale.showMore', {
                    defaultValue: 'Show {{count}} more',
                    count: rationale.bullets.length - visibleBullets.length,
                  })}
            </button>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-c-text-secondary">
              {t('kimi.tabele.rationale.citedSources', { defaultValue: 'Cited sources' })}
            </span>
            {rationale.citedSourceIds.length > 0 ? (
              rationale.citedSourceIds.map((sourceId) => (
                <span
                  key={sourceId}
                  className="rounded-hig-full border border-c-border-subtle bg-c-surface-raised px-2.5 py-1 font-mono text-xs text-c-text/[0.10]/[0.065]"
                >
                  {sourceId}
                </span>
              ))
            ) : (
              <span className="text-xs text-c-text-secondary">
                {t('kimi.tabele.rationale.noSources', { defaultValue: 'No cited sources' })}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-hig-full border px-2.5 py-1 text-xs font-medium ${PROPOSAL_STYLES[proposalStatus]}`}
            >
              {t('kimi.tabele.rationale.proposalStatus', {
                defaultValue: 'Proposal status: {{status}}',
                status: proposalLabel,
              })}
            </span>
            {proposalStatus !== 'none' && onOpenProposalQueue && (
              <button
                type="button"
                onClick={onOpenProposalQueue}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-c-text-secondary underline decoration-c-border underline-offset-4 hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('kimi.tabele.rationale.reviewProposals', {
                  defaultValue: 'Review proposals',
                })}
                <ExternalLink size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TabeleRationaleSection;
