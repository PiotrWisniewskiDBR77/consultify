import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { getMenu3AiButtonClass } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';
import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
} from '@/components/shared/ModuleMenu3';

type Menu3Chip = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number | null;
  active?: boolean;
  /** #70: 1-sentence explanation shown as a native tooltip (jasność dla usera). */
  title?: string;
  /**
   * #71: when set, the chip renders as a real `<button>` (TRIADA_KANON.md §A3
   * "filtry z licznikami, aktywny chip wypełniony") instead of a static,
   * non-interactive `<div>` — wzór: DiscoveryToolsHub CommandRowContent status
   * chip row. Chips without onClick stay decorative `<div>`s (back-compat for
   * existing non-filter callers, e.g. AssessmentSessionEditorView).
   */
  onClick?: () => void;
};

type Menu3Action = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
};

interface AssessmentMenu3ActionBarProps {
  chips?: Menu3Chip[];
  actions: Menu3Action[];
  className?: string;
}

export const AssessmentMenu3ActionBar: React.FC<AssessmentMenu3ActionBarProps> = ({
  chips = [],
  actions,
  className = '',
}) => {
  return (
    // NAPRAWA (audyt MVP 06.09, poz. 5.4): `MENU_3_INNER_CLASS` wsadza
    // `overflow-x-auto` na CAŁY wiersz (chipy + przyciski AI razem). Przy
    // liczbie chipów widocznych na 1440 px suma szerokości przekracza pasek,
    // a że prawy `shrink-0` (przyciski AI, np. „AI Triage") nie może się
    // skurczyć, to CHIPY powinny przewijać się SAME — zamiast tego cały
    // wiersz przewijał się razem, więc domyślna (nieprzewinięta) pozycja
    // ucinała ostatni przycisk AI na prawej krawędzi (widać było „AI Tri…").
    // Wzorzec 1:1 z `StandardModuleBar.tsx` `chipsContent` (`MENU_3_LEFT_CLASS
    // app-table-scrollbar overflow-x-auto whitespace-nowrap`): scroll TYLKO
    // na lewej (chipy), prawa (`MENU_3_RIGHT_CLASS`, już `shrink-0`) zawsze
    // w całości widoczna.
    <div className={`flex min-h-8 items-center justify-between gap-3 ${className}`}>
      <div
        className={`${MENU_3_LEFT_CLASS} min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar`}
      >
        {chips.map((chip) => {
          const content = (
            <>
              {chip.icon || <span className={MENU_3_ALL_DOT_CLASS} />}
              <span className="truncate">{chip.label}</span>
              {chip.badge !== undefined && chip.badge !== null ? (
                <span
                  className={chip.active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}
                  title={typeof chip.badge === 'string' ? chip.badge : undefined}
                >
                  {chip.badge}
                </span>
              ) : null}
            </>
          );
          if (chip.onClick) {
            return (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClick}
                title={chip.title}
                className={chip.active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
              >
                {content}
              </button>
            );
          }
          return (
            <div
              key={chip.id}
              className={chip.active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
              title={chip.title}
            >
              {content}
            </div>
          );
        })}
      </div>

      <div className={MENU_3_RIGHT_CLASS}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={getMenu3AiButtonClass(Boolean(action.active))}
              title={action.title || action.label}
            >
              <Icon size={12} />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export type { Menu3Action, Menu3Chip };

export default AssessmentMenu3ActionBar;
