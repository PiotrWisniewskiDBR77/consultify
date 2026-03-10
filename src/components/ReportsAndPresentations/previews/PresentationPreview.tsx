/**
 * PresentationPreview — Preview panel for presentations
 * Uses shared PreviewPane building blocks for consistent UX.
 */

import { Download, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  PreviewActionBar,
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
}

export const PresentationPreview: React.FC<PresentationPreviewProps> = ({
  presentation,
  onOpen,
  onExport,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const statusMeta =
    PRESENTATION_STATUS_META[presentation.status] || PRESENTATION_STATUS_META.draft;
  const sourceMeta = SOURCE_TYPE_META[presentation.sourceType] || SOURCE_TYPE_META.tool;

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
  ];

  const actionRows: ActionRow[] = [];
  if (onOpen || onExport) {
    actionRows.push({
      buttons: [
        ...(onOpen
          ? [{ label: t('rap.preview.openFull', 'Otwórz pełny'), icon: ExternalLink, onClick: onOpen, colorScheme: 'primary' as const, flex: true }]
          : []),
        ...(onExport
          ? [{ label: t('rap.actions.export', 'Eksportuj'), icon: Download, onClick: onExport, colorScheme: 'neutral' as const }]
          : []),
      ],
    });
  }

  return (
    <div className="space-y-4 text-sm">
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
      {relations.length > 0 && <PreviewRelations items={relations} />}
      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};
