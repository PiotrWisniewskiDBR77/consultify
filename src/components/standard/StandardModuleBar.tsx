/**
 * StandardModuleBar — JEDYNA fasada paska modułu (Menu 1/2/3).
 *
 * SSOT wzorca: żywy ekran My Work Tasks/Decisions + NOTATKA-PRAWO
 * `Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md` (Piotr, 2026-07-04):
 *
 * - MENU 1 (tożsamość) to APP TOPBAR — „nie ruszać". Fasada renderuje jedynie
 *   opcjonalny, cienki wiersz breadcrumb+CTA dla hubów osadzonych (np.
 *   „Tools > Licensed"), które nie sterują topbarem aplikacji.
 * - MENU 2 (funkcjonalne): od LEWEJ lupa + pigułki modułu (ikona+label, h-9,
 *   Z WIDOCZNĄ RAMKĄ, aktywna = neutralne wypełnienie); od PRAWEJ do środka:
 *   primary CTA (ciemny wypełniony, neutral inverted — NIGDY crimson) →
 *   segment przełącznika widoków → ewentualne filtry. DELEGACJA: ModuleNavBar.
 * - MENU 3 (dynamiczne): chipy h-7 text-[11px]; TRZY wymienne tryby w tym
 *   samym pasku: (1) chipy filtrów z licznikami (0 też widoczne, aktywny
 *   wypełniony), (2) pasek akcji bulk przy zaznaczeniu, (3) dynamiczne taby
 *   otwartych kart. Od PRAWEJ slot AI. DELEGACJA: command row ModuleNavBar +
 *   prymitywy ModuleMenu3 (Menu3Chip/Menu3Badge/MENU_3_ACTION_*).
 *
 * Moduły używają WYŁĄCZNIE tej fasady — deklaratywnie, bez własnego chrome.
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import React, { useMemo } from 'react';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ModuleNavBar } from '../shared/ModuleHub/ModuleNavBar';
import type { ModuleTab, OpenDocument, TabConfig, ViewMode } from '../shared/ModuleHub/types';
import {
  MENU_1_BREADCRUMB_CURRENT,
  MENU_1_BREADCRUMB_LINK,
  MENU_1_PRIMARY_CTA,
  MENU_1_ROW_CLASS,
  MENU_3_ACTION_DANGER,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Badge,
  Menu3Chip,
} from '../shared/ModuleMenu3';

const noop = () => undefined;

export interface StandardBreadcrumb {
  label: string;
  onClick?: () => void;
}

export interface StandardModuleTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface StandardCounterChip {
  id: string;
  label: string;
  /** Licznik — zawsze widoczny, także 0 (notatka-prawo §Menu3.1). */
  count?: number;
  /** Optional colored dot (semantic content, not button state). */
  dot?: string;
}

export interface StandardBulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'neutral' | 'danger';
}

export interface StandardBulkState {
  /** Number of selected rows — bar renders only when > 0. */
  count: number;
  selectedLabel?: string;
  onSelectAll?: () => void;
  selectAllLabel?: string;
  onClear?: () => void;
  clearLabel?: string;
  actions: StandardBulkAction[];
}

export interface StandardPrimaryCta {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  testId?: string;
}

export interface StandardModuleBarProps {
  /**
   * Optional Menu 1 row for EMBEDDED hubs (np. „Tools > Licensed"). Gdy moduł
   * karmi breadcrumbami app topbar — pomiń (notatka-prawo: Menu 1 nie ruszać).
   */
  breadcrumbs?: StandardBreadcrumb[];
  /** Rendered on the right of the breadcrumb row (JEDEN primary CTA). */
  breadcrumbCta?: StandardPrimaryCta;

  // ── Menu 2 ────────────────────────────────────────────────────────────────
  /** Pigułki funkcjonalne modułu (h-9, ramka, active = neutral fill). */
  tabs?: StandardModuleTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Lupa (lewy skraj Menu 2) — search rozwija się w command row. */
  onSearch?: (query: string) => void;
  searchValue?: string;
  /** JEDEN primary CTA (ciemny wypełniony) — prawy skraj Menu 2. */
  primaryCta?: StandardPrimaryCta;
  /** Segment przełącznika widoków (ikony); pojedynczy tryb ukrywa segment. */
  viewModes?: ViewMode[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  /** Ewentualne dodatkowe filtry — na lewo od przełącznika widoków. */
  filterControls?: React.ReactNode;

  // ── Menu 3 (trzy wymienne tryby) ─────────────────────────────────────────
  /** Tryb 1: ciche chipy filtrów z licznikami. */
  chips?: StandardCounterChip[];
  activeChip?: string | null;
  onChipChange?: (id: string) => void;
  /** Tryb 2: pasek akcji bulk — nadpisuje pozostałe tryby gdy count > 0. */
  bulk?: StandardBulkState | null;
  /** Tryb 3: dynamiczne taby otwartych kart. */
  openItems?: OpenDocument[];
  activeItemId?: string | null;
  onSelectItem?: (id: string) => void;
  onCloseItem?: (id: string) => void;
  onShowList?: () => void;
  /** Prawy slot Menu 3 — przyciski AI (np. „✦ AI Priorities"). */
  menu3Right?: React.ReactNode;
  /** Active filter chips (z lejków tabeli) — renderowane w command row. */
  activeFilters?: FilterChip[];
  onRemoveFilter?: (id: string) => void;
  onClearFilters?: () => void;

  className?: string;
}

export const StandardModuleBar: React.FC<StandardModuleBarProps> = ({
  breadcrumbs,
  breadcrumbCta,
  tabs,
  activeTab,
  onTabChange,
  onSearch,
  searchValue,
  primaryCta,
  viewModes,
  viewMode = 'table',
  onViewModeChange,
  filterControls,
  chips,
  activeChip,
  onChipChange,
  bulk,
  openItems,
  activeItemId,
  onSelectItem,
  onCloseItem,
  onShowList,
  menu3Right,
  activeFilters,
  onRemoveFilter,
  onClearFilters,
  className,
}) => {
  const navTabs = useMemo<TabConfig[]>(
    () =>
      (tabs ?? []).map((tab) => ({
        id: tab.id as ModuleTab,
        label: tab.label,
        icon: tab.icon ?? null,
      })),
    [tabs]
  );

  const bulkActive = !!bulk && bulk.count > 0;

  // Menu 3 / tryb 2 — pasek akcji bulk (klasy 1:1 z MyWorkHub command row).
  const bulkContent = bulkActive ? (
    <div className="px-4 pb-3">
      <div className={MENU_3_INNER_CLASS}>
        <div className={MENU_3_LEFT_CLASS}>
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
            {bulk!.selectedLabel ?? `${bulk!.count} selected`}
          </span>
          {bulk!.onSelectAll ? (
            <Menu3Chip onClick={bulk!.onSelectAll}>
              {bulk!.selectAllLabel ?? 'Select all'}
            </Menu3Chip>
          ) : null}
          {bulk!.onClear ? (
            <Menu3Chip onClick={bulk!.onClear}>{bulk!.clearLabel ?? 'Clear'}</Menu3Chip>
          ) : null}
        </div>
        <div className={MENU_3_RIGHT_CLASS}>
          {bulk!.actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className={
                  action.variant === 'danger' ? MENU_3_ACTION_DANGER : MENU_3_ACTION_NEUTRAL
                }
              >
                {Icon ? <Icon size={12} /> : null}
                {action.label}
              </button>
            );
          })}
          {menu3Right}
        </div>
      </div>
    </div>
  ) : null;

  // Menu 3 / tryb 1 — ciche chipy z licznikami (0 też widoczne).
  const chipsContent =
    chips && chips.length > 0 ? (
      <div className={`${MENU_3_LEFT_CLASS} overflow-x-auto whitespace-nowrap no-scrollbar`}>
        {chips.map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <Menu3Chip
              key={chip.id}
              active={isActive}
              onClick={() => onChipChange?.(chip.id)}
              aria-pressed={isActive}
              data-testid={`standard-chip-${chip.id}`}
            >
              {chip.dot ? <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} /> : null}
              <span>{chip.label}</span>
              {chip.count !== undefined ? (
                <Menu3Badge count={chip.count} active={isActive} />
              ) : null}
            </Menu3Chip>
          );
        })}
      </div>
    ) : null;

  const primaryCtaNode = primaryCta ? (
    <button
      type="button"
      onClick={primaryCta.onClick}
      data-testid={primaryCta.testId}
      className={MENU_1_PRIMARY_CTA}
    >
      {primaryCta.icon ? <primaryCta.icon size={16} /> : null}
      <span>{primaryCta.label}</span>
    </button>
  ) : undefined;

  return (
    <div className={className}>
      {/* Menu 1 (opcjonalny wiersz dla hubów osadzonych) */}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className={MENU_1_ROW_CLASS}>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {idx > 0 ? (
                    <ChevronRight size={14} className="shrink-0 text-c-text-muted" />
                  ) : null}
                  {crumb.onClick && !isLast ? (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className={MENU_1_BREADCRUMB_LINK}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={isLast ? MENU_1_BREADCRUMB_CURRENT : MENU_1_BREADCRUMB_LINK}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
          {breadcrumbCta ? (
            <button
              type="button"
              onClick={breadcrumbCta.onClick}
              data-testid={breadcrumbCta.testId}
              className={MENU_1_PRIMARY_CTA}
            >
              {breadcrumbCta.icon ? <breadcrumbCta.icon size={16} /> : null}
              <span>{breadcrumbCta.label}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Menu 2 + Menu 3 — delegacja do ModuleNavBar (lupa | pigułki … filtry → widoki → CTA) */}
      <ModuleNavBar
        tabs={navTabs}
        activeTab={(activeTab ?? navTabs[0]?.id ?? 'list') as ModuleTab}
        onTabChange={(tab) => onTabChange?.(String(tab))}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange ?? noop}
        availableViewModes={viewModes ?? ['table']}
        onSearch={onSearch ?? noop}
        searchValue={searchValue}
        rightControls={filterControls}
        primaryCta={primaryCtaNode}
        openDocuments={openItems ?? []}
        activeDocumentId={activeItemId ?? null}
        onSelectDocument={onSelectItem ?? noop}
        onCloseDocument={onCloseItem ?? noop}
        onShowList={onShowList ?? noop}
        activeFilters={activeFilters ?? []}
        onRemoveFilter={onRemoveFilter ?? noop}
        onClearFilters={onClearFilters ?? noop}
        forceCommandRow={bulkActive}
        commandRowContent={bulkActive ? bulkContent : chipsContent}
        commandRowRightContent={bulkActive ? undefined : menu3Right}
      />
    </div>
  );
};

export default StandardModuleBar;
