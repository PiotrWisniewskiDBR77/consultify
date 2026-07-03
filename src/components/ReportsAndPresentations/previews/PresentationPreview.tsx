import { FileDown, ClipboardCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionBar } from '@/components/shared/PreviewPane/PreviewActionBar';
import { PreviewMetaCard, type MetaPill } from '@/components/shared/PreviewPane/PreviewMetaCard';
import { statusChipTone } from '@/components/ui/primitives/chips/EntityStatusChip';

import { sourceTypeLabel, statusLabel } from '../previewLabels';
import {
  TrustStatePreviewSection,
  type TrustStatePreviewSectionProps,
} from '../TrustStatePreviewSection';
import type { PresentationItem } from '../types';

type PresentationPreviewFooterProps = {
  presentation: PresentationItem;
  onStartReview?: () => Promise<void>;
  reviewActionDisabled?: boolean;
  onExport?: () => void;
};

type PresentationPreviewBodyProps = {
  presentation: PresentationItem;
  trustProps?: TrustStatePreviewSectionProps;
};

/**
 * Presentation preview body — TABLE_AND_PREVIEW_CANON §7.3 meta bar.
 * Localized status chip + source/slides/owner pills; raw enums removed, empty
 * fields fall back to "—" (§0.12). Title stays in the panel header only.
 */
export const PresentationPreviewBody: React.FC<PresentationPreviewBodyProps> = ({
  presentation,
  trustProps,
}) => {
  const { t } = useTranslation();
  const DASH = '—';
  const tone = statusChipTone(presentation.status);

  const pills: MetaPill[] = [
    {
      label: statusLabel(t, presentation.status),
      tone: (['info', 'neutral', 'success', 'warning', 'danger'] as const).includes(tone as never)
        ? (tone as MetaPill['tone'])
        : 'neutral',
    },
    {
      label: t('common.type', 'Type'),
      value: sourceTypeLabel(t, presentation.sourceType) || DASH,
      tone: 'neutral',
    },
    {
      label: t('reports.slides', 'slides'),
      value:
        typeof presentation.slideCount === 'number' ? presentation.slideCount : DASH,
      tone: 'neutral',
    },
    {
      label: t('common.owner', 'Owner'),
      value: presentation.owner?.trim() || DASH,
      tone: 'neutral',
    },
  ];

  return (
    <div className="space-y-3">
      <PreviewMetaCard pills={pills} />
      {trustProps ? <TrustStatePreviewSection {...trustProps} /> : null}
    </div>
  );
};

/**
 * Presentation preview footer — canon §7.3b via PreviewActionBar.
 */
export const PresentationPreviewFooter: React.FC<PresentationPreviewFooterProps> = ({
  presentation,
  onStartReview,
  reviewActionDisabled = false,
  onExport,
}) => {
  const { t } = useTranslation();

  const buttons = [
    onExport
      ? {
          label: t('common.export', 'Export'),
          icon: FileDown,
          onClick: () => onExport(),
          colorScheme: 'neutral' as const,
        }
      : null,
    onStartReview
      ? {
          label: t('reports.preview.startReview', 'Start review'),
          icon: ClipboardCheck,
          onClick: () => void onStartReview(),
          colorScheme: 'primary' as const,
          disabled: reviewActionDisabled,
        }
      : null,
  ].filter(Boolean) as NonNullable<
    Parameters<typeof PreviewActionBar>[0]['rows']
  >[number]['buttons'];

  return (
    <div className="space-y-2.5">
      {presentation.updatedAt ? (
        <div className="text-[11px] text-c-text-muted">
          {t('common.updated', 'Updated')}: {presentation.updatedAt}
        </div>
      ) : null}
      {buttons.length > 0 ? <PreviewActionBar rows={[{ buttons }]} /> : null}
    </div>
  );
};
