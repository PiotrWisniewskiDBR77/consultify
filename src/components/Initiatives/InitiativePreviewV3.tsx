import { ChevronRight, ExternalLink, MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';

export type InitiativePreviewV3Model = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  axis?: string;
  priority?: string;
  progress?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  summary?: string | null;
  description?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  ownerBusiness?: { firstName?: string; lastName?: string } | null;
  ownerExecution?: { firstName?: string; lastName?: string } | null;
  sourceType?: string | null;
  sourceId?: string | null;
};

const formatDate = (value: unknown): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const pillBase =
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent';

export const InitiativePreviewV3Body: React.FC<{
  initiative: InitiativePreviewV3Model;
  detailsExpanded?: boolean;
  onToggleDetailsExpanded?: () => void;
  onSummarize?: () => Promise<void> | void;
}> = ({ initiative, detailsExpanded, onToggleDetailsExpanded, onSummarize }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Reset internal state when switching items.
  useEffect(() => {
    setInternalExpanded(false);
  }, [initiative.id]);

  const expanded = detailsExpanded ?? internalExpanded;
  const toggleExpanded = () => {
    if (onToggleDetailsExpanded) onToggleDetailsExpanded();
    else setInternalExpanded((v) => !v);
  };

  const status = String(initiative.status || '').toUpperCase() || '—';
  const axis = String(initiative.axis || '').trim();
  const priority = String(initiative.priority || '').trim();
  const progress =
    initiative.progress == null || Number.isNaN(Number(initiative.progress))
      ? null
      : Math.max(0, Math.min(100, Number(initiative.progress)));

  const createdAt = formatDate(initiative.createdAt);
  const updatedAt = formatDate(initiative.updatedAt);

  const detailsText = String(initiative.summary || initiative.description || '').trim();

  const handleCopy = useCallback(async () => {
    try {
      const title = String(initiative.name || initiative.title || '').trim();
      await navigator.clipboard.writeText([title, '', detailsText].filter(Boolean).join('\n'));
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    }
  }, [detailsText, initiative.name, initiative.title, isPolish]);

  const detailsMenu = useMemo(() => {
    const menu: RowAction[] = [
      {
        id: 'toggle',
        label: expanded ? (isPolish ? 'Zwiń' : 'Collapse') : isPolish ? 'Rozwiń' : 'Expand',
        onClick: toggleExpanded,
      },
      {
        id: 'summarize',
        label: isPolish ? 'Podsumuj' : 'Summarize',
        onClick: async () => {
          await onSummarize?.();
        },
      },
      {
        id: 'copy',
        label: isPolish ? 'Kopiuj' : t('common.copy', 'Copy'),
        divider: true,
        onClick: async () => {
          await handleCopy();
        },
      },
    ];
    return menu;
  }, [expanded, handleCopy, isPolish, onSummarize, t]);

  return (
    <div className="space-y-4">
      {/* Brief / meta card */}
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className={`${pillBase} text-slate-700 dark:text-slate-200`}>
            {isPolish ? 'Inicjatywa' : 'Initiative'}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
            <span className={`${pillBase} text-slate-700 dark:text-slate-200`}>{status.replace(/_/g, ' ')}</span>
            {progress != null ? (
              <span className={`${pillBase} text-slate-700 dark:text-slate-200`}>
                <span className="text-slate-500 dark:text-slate-400">{t('preview.progress', 'Progress')}</span>
                <span className="text-slate-900 dark:text-white">{progress}%</span>
              </span>
            ) : null}
            {axis ? (
              <span className={`${pillBase} text-slate-700 dark:text-slate-200`}>
                <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Oś' : 'Axis'}</span>
                <span className="text-slate-900 dark:text-white">{axis}</span>
              </span>
            ) : null}
            {priority ? (
              <span className={`${pillBase} text-slate-700 dark:text-slate-200`}>
                <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Pilność' : 'Priority'}</span>
                <span className="text-slate-900 dark:text-white">{priority}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-slate-500 dark:text-slate-400">{isPolish ? 'Utworzono' : 'Created'}</div>
            <div className="text-slate-900 dark:text-white">{createdAt}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-500 dark:text-slate-400">{isPolish ? 'Ostatnia zmiana' : 'Last modified'}</div>
            <div className="text-slate-900 dark:text-white">{updatedAt}</div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isPolish ? 'Szczegóły' : 'Details'}
          </div>
          <RowActionsMenu iconVariant="vertical" actions={detailsMenu} />
        </div>

        <div
          className={[
            'text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap',
            expanded ? '' : 'line-clamp-6',
          ].join(' ')}
        >
          {detailsText || (isPolish ? 'Brak opisu.' : 'No description.')}
        </div>
      </div>
    </div>
  );
};

export const InitiativePreviewV3Footer: React.FC<{
  initiative: InitiativePreviewV3Model;
  tasksCount?: number;
  onOpenFull: () => void;
  onOpenInModule?: () => void;
  onOpenChat?: (prompt: string) => Promise<void> | void;
  onCopyLink?: () => Promise<void> | void;
  extraActionsSlot?: React.ReactNode;
}> = ({ initiative, tasksCount, onOpenFull, onOpenInModule, onOpenChat, onCopyLink, extraActionsSlot }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const footerPillBase =
    'inline-flex items-center justify-center gap-2 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
  const hintChipClass =
    'inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors active:scale-[0.98]';
  const pillNeutral = `${footerPillBase} border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`;
  const pillPrimary = `${footerPillBase} border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-300 hover:bg-primary-500/15`;

  const sourceType = String(initiative.sourceType || '').trim();
  const sourceId = String(initiative.sourceId || '').trim();
  const sourceLabel = sourceType
    ? sourceId
      ? `${sourceType} · ${sourceId.slice(0, 8)}…`
      : sourceType
    : '—';

  const aiHints = isPolish
    ? [
        { label: 'Kolejne kroki', prompt: 'Zaproponuj 3 kolejne kroki dla tej inicjatywy.' },
        { label: 'Ryzyka', prompt: 'Wypisz 5 ryzyk i propozycje mitigacji dla tej inicjatywy.' },
        { label: 'Zakres', prompt: 'Ułóż krótki zakres i kryteria sukcesu dla tej inicjatywy.' },
      ]
    : [
        { label: 'Next steps', prompt: 'Propose 3 next steps for this initiative.' },
        { label: 'Risks', prompt: 'List 5 risks and mitigations for this initiative.' },
        { label: 'Scope', prompt: 'Draft a short scope and success criteria for this initiative.' },
      ];

  const aiMenu: RowAction[] = [
    {
      id: 'regenerate',
      label: isPolish ? 'Regeneruj' : 'Regenerate',
      onClick: () =>
        onOpenChat?.(
          isPolish
            ? 'Wygeneruj 3 szybkie hinty (co zrobić / na co uważać / jak mierzyć).'
            : 'Generate 3 quick hints (what to do / risks / how to measure).'
        ),
    },
    ...(onCopyLink
      ? ([
          {
            id: 'copy-link',
            label: isPolish ? 'Kopiuj link' : 'Copy link',
            divider: true,
            onClick: async () => {
              await onCopyLink();
            },
          },
        ] as RowAction[])
      : []),
  ];

  const relationsPill = (label: string, value: string, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border',
        'border-slate-200/70 dark:border-white/[0.08]',
        'bg-transparent',
        onClick
          ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors'
          : 'text-slate-500 dark:text-slate-400 cursor-default',
      ].join(' ')}
    >
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="truncate max-w-[220px]">{value}</span>
    </button>
  );

  return (
    <div className="space-y-0">
      {/* AI zone */}
      <div className="py-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
          </div>
          <RowActionsMenu iconVariant="vertical" actions={aiMenu} />
        </div>
        <div className="flex flex-wrap gap-2">
          {aiHints.map((h) => (
            <button
              key={h.label}
              type="button"
              onClick={() => onOpenChat?.(h.prompt)}
              className={hintChipClass}
              disabled={!onOpenChat}
            >
              {h.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          {isPolish ? 'Użyj AI hintów, aby wygenerować brief.' : 'Use AI hints to generate a brief.'}
        </div>
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      {/* Relations (2 rows) */}
      <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1">
        {relationsPill(isPolish ? 'Źródło' : 'Source', sourceLabel)}
        {typeof tasksCount === 'number' ? relationsPill(isPolish ? 'Zadania' : 'Tasks', String(tasksCount)) : null}
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      {/* Actions */}
      <div className="space-y-2.5 py-1">
        {extraActionsSlot ? (
          extraActionsSlot
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={onOpenFull} className={pillPrimary}>
              <ExternalLink size={14} />
              {isPolish ? 'Otwórz' : 'Open'}
            </button>
            {onOpenInModule ? (
              <button type="button" onClick={onOpenInModule} className={pillNeutral}>
                <ChevronRight size={14} />
                {isPolish ? 'W module' : 'In module'}
              </button>
            ) : null}
            {onOpenChat ? (
              <button
                type="button"
                onClick={() =>
                  onOpenChat(
                    isPolish
                      ? 'Pomóż mi dopracować tę inicjatywę: brakujące pola, ryzyka, KPI i następne kroki.'
                      : 'Help me refine this initiative: missing fields, risks, KPIs, and next steps.'
                  )
                }
                className={pillNeutral}
              >
                <MessageSquare size={14} />
                {isPolish ? 'Czat' : 'Chat'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default InitiativePreviewV3Body;
