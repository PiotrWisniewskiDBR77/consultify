import { ChevronDown, Copy, FileText, type LucideIcon, MessageSquare, MoreVertical, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  text: string;
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
}

export const PreviewDetailsSection: React.FC<PreviewDetailsSectionProps> = ({
  text,
  loading,
  customActions,
  onExpand,
  onSummarize,
  onCopy,
  extraCopyFormats,
  expanded,
  onToggleExpanded,
  label,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [menuOpen, setMenuOpen] = useState(false);

  const defaultActions: DetailsAction[] = [
    ...(onExpand
      ? [
          {
            id: 'expand',
            label: isPolish ? 'Rozwiń' : 'Expand',
            icon: ChevronDown,
            onClick: onExpand,
          },
        ]
      : []),
    ...(onSummarize
      ? [
          {
            id: 'summarize',
            label: isPolish ? 'Podsumuj' : 'Summarize',
            icon: Sparkles,
            onClick: onSummarize,
          },
        ]
      : []),
    ...(onCopy
      ? [
          {
            id: 'copy',
            label: isPolish ? 'Kopiuj' : 'Copy',
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

  const actions = customActions ?? defaultActions;
  const hasMenu = actions.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label ?? (isPolish ? 'Szczegóły' : 'Details')}
        </div>

        {hasMenu ? (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className={KEBAB_BUTTON}
              aria-label={isPolish ? 'Opcje szczegółów' : 'Details options'}
              title={isPolish ? 'Opcje' : 'Options'}
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
                                  ? 'text-purple-500'
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

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className={SKELETON_LINE_1} />
          <div className={SKELETON_LINE_2} />
          <div className={SKELETON_LINE_3} />
          <div className={SKELETON_LINE_4} />
        </div>
      ) : (
        <div
          className={[
            'text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap',
            expanded === false ? 'line-clamp-6' : '',
          ].join(' ')}
          onClick={onToggleExpanded}
        >
          {text || (isPolish ? 'Brak opisu.' : 'No description.')}
        </div>
      )}
    </div>
  );
};

export default PreviewDetailsSection;
