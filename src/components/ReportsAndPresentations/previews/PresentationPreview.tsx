/**
 * PresentationPreview — Preview panel for presentations
 * Uses shared PreviewPane building blocks for consistent UX.
 * Exports Body + Footer for proper TableWithPreviewLayout split.
 */

import { Download, ExternalLink, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type ActionRow,
  type MetaPill,
  type RelationItem,
} from '@/components/shared/PreviewPane';

import { PRESENTATION_STATUS_META, type PresentationItem, SOURCE_TYPE_META } from '../types';

interface PresentationPreviewProps {
  presentation: PresentationItem;
  onOpen?: () => void;
  onExport?: () => void;
  onStartReview?: () => void;
  reviewActionDisabled?: boolean;
}

function usePresentationPreviewData(presentation: PresentationItem) {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const statusMeta =
    PRESENTATION_STATUS_META[presentation.status] || PRESENTATION_STATUS_META.draft;
  const sourceMeta = SOURCE_TYPE_META[presentation.sourceType] || SOURCE_TYPE_META.tool;
  const governance = presentation.governance;

  const pills: MetaPill[] = [
    {
      label: isPolish ? sourceMeta.labelPl : sourceMeta.label,
      className: `bg-slate-100 dark:bg-white/[0.06] ${sourceMeta.color}`,
    },
    {
      label: isPolish ? statusMeta.labelPl : statusMeta.label,
      className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
      dot: statusMeta.dotColor,
    },
  ];

  const detailLines = [
    `${isPolish ? 'Właściciel' : 'Owner'}: ${presentation.owner}`,
    `${isPolish ? 'Źródło' : 'Source'}: ${isPolish ? sourceMeta.labelPl : sourceMeta.label}`,
    `${isPolish ? 'Tryb' : 'Mode'}: ${presentation.presentationMode || 'briefing'}`,
    `${isPolish ? 'Slajdy' : 'Slides'}: ${presentation.slideCount}`,
    `${isPolish ? 'Visibility' : 'Visibility'}: ${governance?.visibilityScope || '—'}`,
    `${isPolish ? 'Publish state' : 'Publish state'}: ${governance?.publishState || '—'}`,
    `${isPolish ? 'Review gates' : 'Review gates'}: ${governance?.reviewGateCount ?? 0}`,
    `${isPolish ? 'Project' : 'Project'}: ${governance?.projectId || '—'}`,
    `${isPolish ? 'Utworzono' : 'Created'}: ${new Date(presentation.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    `${isPolish ? 'Ostatnia zmiana' : 'Updated'}: ${new Date(presentation.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].join('\n');

  const relations: RelationItem[] = [
    ...(presentation.exportFormats?.length
      ? presentation.exportFormats.map((fmt) => ({ label: fmt }))
      : []),
    ...(presentation.sourceRefs?.length
      ? [{ label: `${presentation.sourceRefs.length} ${isPolish ? 'referencji' : 'references'}` }]
      : []),
    ...(governance?.publishReviewers?.length
      ? [{ label: `${governance.publishReviewers.length} ${isPolish ? 'reviewerów' : 'reviewers'}` }]
      : []),
    ...(governance?.accessGrants?.length
      ? [{ label: `${governance.accessGrants.length} ${isPolish ? 'grantów dostępu' : 'access grants'}` }]
      : []),
  ];

  return { isPolish, t, pills, detailLines, relations };
}

export const PresentationPreviewBody: React.FC<PresentationPreviewProps> = ({ presentation }) => {
  const { isPolish, pills, detailLines } = usePresentationPreviewData(presentation);

  return (
    <div className="space-y-4">
      {/* Thumbnail */}
      <div className="w-full aspect-[16/9] rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-navy-700 dark:to-navy-600 flex items-center justify-center overflow-hidden">
        {presentation.thumbnailUrl ? (
          <img
            src={presentation.thumbnailUrl}
            alt={presentation.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-400 dark:text-slate-500">PPT</span>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {presentation.slideCount} {isPolish ? 'slajdów' : 'slides'}
            </p>
          </div>
        )}
      </div>

      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection text={detailLines} label={isPolish ? 'SZCZEGÓŁY' : 'DETAILS'} />
    </div>
  );
};

export const PresentationPreviewFooter: React.FC<PresentationPreviewProps> = ({
  presentation,
  onOpen,
  onExport,
  onStartReview,
  reviewActionDisabled,
}) => {
  const { isPolish, t, relations } = usePresentationPreviewData(presentation);
  const governance = presentation.governance;

  const actionRows: ActionRow[] = [];
  if (onOpen || onExport) {
    actionRows.push({
      buttons: [
        ...(onStartReview
          ? [{
              label: t('rap.actions.startReview', 'Start review'),
              icon: ShieldCheck,
              onClick: onStartReview,
              colorScheme: 'purple' as const,
              disabled: reviewActionDisabled,
              shortcut: 'R',
            }]
          : []),
        ...(onOpen
          ? [{ label: t('rap.preview.openFull', 'Otwórz pełny'), icon: ExternalLink, onClick: onOpen, colorScheme: 'primary' as const, flex: true, shortcut: 'O' }]
          : []),
        ...(onExport
          ? [{ label: t('rap.actions.export', 'Eksportuj'), icon: Download, onClick: onExport, colorScheme: 'neutral' as const, shortcut: 'E' }]
          : []),
      ],
    });
  }

  const dividerClass = 'border-t border-slate-200/50 dark:border-white/[0.06] my-3';

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip
          hints={[
            isPolish ? 'Prezentacja gotowa do przeglądu' : 'Presentation ready for review',
            governance?.visibilityScope
              ? `${isPolish ? 'Scope' : 'Scope'}: ${governance.visibilityScope}`
              : null,
            governance?.publishState
              ? `${isPolish ? 'Review' : 'Review'}: ${governance.publishState}`
              : null,
          ].filter(Boolean) as string[]}
        />
      </div>
      {relations.length > 0 && (
        <>
          <div className={dividerClass} />
          <PreviewRelations items={relations} />
        </>
      )}
      <div className={dividerClass} />
      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};

/** @deprecated Use PresentationPreviewBody + PresentationPreviewFooter for Body/Footer split */
export const PresentationPreview: React.FC<PresentationPreviewProps> = (props) => {
  return (
    <>
      <PresentationPreviewBody {...props} />
      <PresentationPreviewFooter {...props} />
    </>
  );
};
