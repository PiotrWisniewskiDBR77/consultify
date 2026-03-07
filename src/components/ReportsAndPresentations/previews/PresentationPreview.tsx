/**
 * PresentationPreview — Preview panel for presentations
 * Golden standard §6.10a: Thumbnail → Entity Meta → Content → Actions
 */

import { Download, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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

      {/* Entity Meta Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] ${sourceMeta.color}`}
        >
          {isPolish ? sourceMeta.labelPl : sourceMeta.label}
        </span>
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/10">
          <span className={`w-2 h-2 rounded-full ${statusMeta.dotColor}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isPolish ? statusMeta.labelPl : statusMeta.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <DetailRow label={isPolish ? 'Właściciel' : 'Owner'} value={presentation.owner} />
        <DetailRow
          label={isPolish ? 'Źródło' : 'Source'}
          value={isPolish ? sourceMeta.labelPl : sourceMeta.label}
        />
        <DetailRow
          label={isPolish ? 'Tryb' : 'Mode'}
          value={presentation.presentationMode || 'briefing'}
        />
        <DetailRow label={isPolish ? 'Slajdy' : 'Slides'} value={String(presentation.slideCount)} />
        <DetailRow
          label={isPolish ? 'Utworzono' : 'Created'}
          value={new Date(presentation.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
        <DetailRow
          label={isPolish ? 'Ostatnia zmiana' : 'Updated'}
          value={new Date(presentation.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
      </div>

      {/* Export formats */}
      {presentation.exportFormats?.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isPolish ? 'Eksporty' : 'Exports'}
          </span>
          <div className="flex items-center gap-1.5">
            {presentation.exportFormats.map((fmt) => (
              <span
                key={fmt}
                className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>
      )}

      {presentation.sourceRefs && presentation.sourceRefs.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isPolish ? 'Powiązane źródła' : 'Linked sources'}
          </span>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {presentation.sourceRefs.length} {isPolish ? 'referencji' : 'references'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
          onClick={onOpen}
        >
          <ExternalLink size={14} />
          {t('rap.preview.openFull', 'Otwórz pełny')}
        </button>
        <button
          type="button"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200/70 dark:border-white/[0.06] text-slate-500 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
          onClick={onExport}
          title={t('rap.actions.export', 'Eksportuj')}
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-slate-700 dark:text-slate-200 font-medium">{value}</span>
  </div>
);
