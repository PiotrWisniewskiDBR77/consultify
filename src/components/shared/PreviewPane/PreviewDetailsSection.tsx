import {
  ChevronDown,
  Copy,
  FileText,
  type LucideIcon,
  MessageSquare,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  KEBAB_BACKDROP,
  KEBAB_BUTTON,
  KEBAB_ITEM,
  KEBAB_MENU,
  SKELETON_LINE_1,
  SKELETON_LINE_2,
  SKELETON_LINE_3,
  SKELETON_LINE_4,
} from './previewStyles';

export interface DetailsAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

export interface ExtraCopyFormat {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

export interface PreviewDetailsSectionProps {
  text?: string;
  detailsText?: string[];
  title?: string;
  loading?: boolean;
  /** Replace default Expand/Summarize/Copy with custom actions */
  customActions?: DetailsAction[];
  /** Standard callbacks — used when customActions is not provided */
  onExpand?: () => void;
  onSummarize?: () => void;
  onCopy?: () => void;
  /** Additional copy format options appended after the default Copy action (e.g. "Copy as Markdown", "Copy for Slack") */
  extraCopyFormats?: ExtraCopyFormat[];
  /** Clamp text with line-clamp-N unless expanded */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  /** Override the section label (defaults to "Details" / "Szczegóły") */
  label?: string;
  /** Compact mode: smaller font (text-xs instead of text-sm) for space-constrained previews */
  compact?: boolean;
  /**
   * Licznik słów ma sens dla PROZY — mówi „ile tu jest czytania". Przy treści,
   * która prozą nie jest, kłamie: podgląd Sejfu klienta pokazywał `~30 words`
   * nad LISTĄ PLIKÓW (przegląd 128 zrzutów, PILNE-8), gdzie liczba słów nie
   * znaczy nic — plików było pięć.
   *
   * Domyślnie `true`, żeby nie ruszać ekranów z prawdziwym opisem.
   */
  showWordCount?: boolean;
  /** Optional structured content rendered below the text block */
  children?: React.ReactNode;
}

export const PreviewDetailsSection: React.FC<PreviewDetailsSectionProps> = ({
  text,
  detailsText,
  title,
  loading,
  customActions,
  onExpand,
  onSummarize,
  onCopy,
  extraCopyFormats,
  expanded,
  onToggleExpanded,
  label,
  compact,
  showWordCount = true,
  children,
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const resolvedText = text ?? detailsText?.join('\n') ?? '';

  const defaultActions: DetailsAction[] = [
    ...(onExpand
      ? [
          {
            id: 'expand',
            label: t('sharedComponents.previewDetailsSection.expand'),
            icon: ChevronDown,
            onClick: onExpand,
          },
        ]
      : []),
    ...(onSummarize
      ? [
          {
            id: 'summarize',
            label: t('sharedComponents.previewDetailsSection.summarize'),
            icon: Sparkles,
            onClick: onSummarize,
          },
        ]
      : []),
    ...(onCopy
      ? [
          {
            id: 'copy',
            label: t('sharedComponents.previewDetailsSection.copy'),
            icon: Copy,
            onClick: onCopy,
          },
        ]
      : []),
    ...(extraCopyFormats ?? []).map((fmt, i) => ({
      id: `extra-copy-${i}`,
      label: fmt.label,
      icon: fmt.icon ?? (i === 0 ? FileText : MessageSquare),
      onClick: fmt.onClick,
    })),
  ];

  /**
   * KEBAB BLOKU 3 NIE MOŻE ZNIKAĆ — wbudowane „Kopiuj" jako dno.
   *
   * ── CO BYŁO ZMIERZONE (dyżur rodziny podglądu, 2026-09-01) ────────────────
   * Kanon (`TABLE_AND_PREVIEW_CANON.md` §7.0 wiersz 3) mówi, że blok „Treść"
   * MA kebab lokalny. Ale kebab renderował się wyłącznie wtedy, gdy ekran sam
   * podał `customActions` albo któryś z `onCopy`/`onExpand`/`onSummarize` —
   * czyli kanon był OPCJĄ, którą trzeba pamiętać, a nie własnością bloku.
   *
   * Policzone: OSIEM plików produkcyjnych renderowało blok 3 BEZ kebaba —
   * `MyWork/IdeasTableContent.tsx` (zgłoszony `idea-table`), `AIChat/
   * AgentHubShell.tsx`, `AIChat/TransformationCasesPanel.tsx`, `Results/
   * ResultsKpiReportsView.tsx`, `Results/ResultsReportingEnterpriseViews.tsx`,
   * `Results/ResultsInitiativesView.tsx`, `Results/KpiQueueView.tsx`,
   * `views/vault/VaultSafesTable.tsx`. Zmierzone na żywym DOM: `idea-table`
   * ma w nagłówku bloku 3 **0 przycisków**, wzorzec `StandardPreview` ma 1.
   *
   * „Kopiuj" nie potrzebuje niczego od ekranu — komponent MA tekst. Więc gdy
   * ekran nie poda żadnej akcji, a treść jest, dokładamy kopiowanie z własnego
   * `resolvedText`. Ekran, który poda swoje akcje, nadpisuje to bez zmian.
   * Dzięki temu naprawa nie odrasta per-wywołanie (pamięć: „naprawa
   * per-wywolanie odrasta" — ten sam defekt wrócił po 8 tygodniach w 12 plikach).
   */
  const builtInCopy: DetailsAction = {
    id: 'copy',
    label: t('sharedComponents.previewDetailsSection.copy'),
    icon: Copy,
    onClick: () => {
      navigator.clipboard
        .writeText(resolvedText)
        .then(() => toast.success(t('sharedComponents.previewAIHintStrip.copied')))
        .catch(() => toast.error(t('sharedComponents.previewAIHintStrip.copyFailed')));
    },
  };

  const resolvedActions = customActions ?? defaultActions;
  const actions =
    resolvedActions.length === 0 && resolvedText.trim() ? [builtInCopy] : resolvedActions;
  const hasMenu = actions.length > 0;

  // Word count — only shown when there is content (canon §7.3)
  const wordCount = resolvedText.trim()
    ? resolvedText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div data-preview-block="details" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title ?? label ?? t('sharedComponents.previewDetailsSection.details')}
        </div>

        <div className="flex items-center gap-2">
          {showWordCount && wordCount > 0 ? (
            <span
              className="text-[10px] text-slate-400 dark:text-slate-500"
              aria-label={`${wordCount} ${t('sharedComponents.previewDetailsSection.words')}`}
            >
              ~{wordCount} {t('sharedComponents.previewDetailsSection.words')}
            </span>
          ) : null}
          {hasMenu ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className={KEBAB_BUTTON}
                aria-label={t('sharedComponents.previewDetailsSection.detailsOptions')}
                title={t('sharedComponents.previewDetailsSection.options')}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen ? (
                <>
                  <div className={KEBAB_BACKDROP} onClick={() => setMenuOpen(false)} />
                  <div className={KEBAB_MENU}>
                    {actions.map((action, idx) => {
                      const ActionIcon = action.icon;
                      return (
                        <React.Fragment key={action.id}>
                          {action.id === 'copy' && idx > 0 ? (
                            <div className="border-t border-slate-200/70 dark:border-white/[0.08]" />
                          ) : null}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(false);
                              action.onClick();
                            }}
                            disabled={action.disabled}
                            className={`${KEBAB_ITEM}${action.disabled ? ' opacity-40' : ''}`}
                          >
                            {ActionIcon ? (
                              <ActionIcon
                                size={12}
                                className={
                                  action.id === 'expand' || action.id === 'summarize'
                                    ? 'text-c-info'
                                    : ''
                                }
                              />
                            ) : null}
                            {action.label}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className={SKELETON_LINE_1} />
          <div className={SKELETON_LINE_2} />
          <div className={SKELETON_LINE_3} />
          <div className={SKELETON_LINE_4} />
        </div>
      ) : (
        <>
          {resolvedText ? (
            <div
              className={[
                compact
                  ? 'text-xs text-slate-700 dark:text-slate-200 leading-relaxed'
                  : 'text-sm text-slate-700 dark:text-slate-200 leading-relaxed',
                'prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0',
                expanded === false ? 'line-clamp-6' : '',
              ].join(' ')}
              onClick={onToggleExpanded}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolvedText}</ReactMarkdown>
            </div>
          ) : !children ? (
            <div
              className={
                compact ? 'text-xs text-slate-600 italic' : 'text-sm text-slate-600 italic'
              }
            >
              {t('sharedComponents.previewDetailsSection.noDescription')}
            </div>
          ) : null}
          {children}
        </>
      )}
    </div>
  );
};

export default PreviewDetailsSection;
