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
import { ModuleNavBar, type StatusFilter } from '../shared/ModuleHub/ModuleNavBar';
import type {
  CategoryButton,
  ModuleTab,
  OpenDocument,
  TabConfig,
  ViewMode,
} from '../shared/ModuleHub/types';
import {
  MENU_1_BREADCRUMB_CURRENT,
  MENU_1_BREADCRUMB_LINK,
  MENU_1_PRIMARY_CTA,
  MENU_1_ROW_CLASS,
  MENU_3_LEFT_CLASS,
  Menu3Badge,
  Menu3BulkRow,
  Menu3Chip,
} from '../shared/ModuleMenu3';

const noop = () => undefined;

// Wariant zablokowanego (pilot-lock) primaryCta — ten sam kształt (rounded-lg,
// h-9) co MENU_1_PRIMARY_CTA, powierzchnia wyciszona zamiast wypełnienia
// granatem. Kursor `not-allowed` to sam WYGLĄD — przycisk NADAL jest klikalny
// (patrz `locked` w StandardPrimaryCta). 1:1 z dotychczasowym wyglądem
// w Initiatives.
const MENU_1_PRIMARY_CTA_LOCKED =
  'inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-muted cursor-not-allowed';

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
  /**
   * Disabled state for the SUBSET of selected rows this action can't apply to
   * (e.g. bulk-cancel when every selected row is already finished). The bulk
   * bar itself only renders when count > 0 — this covers the narrower case
   * where a selection exists but none of it is eligible. Pair with `title`
   * for the tooltip explaining why.
   */
  disabled?: boolean;
  /** Tooltip shown on hover — required reading when `disabled` is true. */
  title?: string;
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
  /**
   * Doktryna „uprawnienia bramkują akcje" (termin domenowy: pilot lock —
   * `isPilotParticipant`/`PILOT_LOCKED`). CTA NIE znika i NIE jest natywnie
   * `disabled` — `onClick` MUSI się odpalić (typowo `dispatchPilotAccessBlocked`,
   * które pokazuje globalny komunikat + CTA „przejdź gdzie indziej"). Tylko
   * wygląd zmienia się na wyciszony, z wyjaśnieniem w tooltipie (`lockedReason`).
   * Zablokowanie natywnym `disabled` zjadałoby ten komunikat — nie robimy tego.
   */
  locked?: boolean;
  lockedReason?: string;
}

export interface StandardModuleBarProps {
  /**
   * Optional Menu 1 row for EMBEDDED hubs (np. „Tools > Licensed"). Gdy moduł
   * karmi breadcrumbami app topbar — pomiń (notatka-prawo: Menu 1 nie ruszać).
   */
  breadcrumbs?: StandardBreadcrumb[];
  /** Rendered on the right of the breadcrumb row (JEDEN primary CTA). */
  breadcrumbCta?: StandardPrimaryCta;
  /**
   * Slot NA SAMYM PRAWYM SKRAJU wiersza Menu 1 — przeznaczony na kebab karty
   * (`RowActionsMenu`) hubów osadzonych, np. „Sejf klienta › [nazwa]".
   * Addytywne: brak propa ⇒ wiersz renderuje się bajt w bajt jak dotąd.
   * NIE służy do dokładania własnych przycisków akcji — te idą przez
   * `breadcrumbCta` (Menu 1) albo `primaryCta` (Menu 2).
   */
  breadcrumbExtra?: React.ReactNode;

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
  /**
   * Luk ucieczkowy: gdy hub ma WIĘCEJ niż jeden element w slocie CTA (np.
   * Interview — CTA per-zakładka + flag-gated „+ Nowy" launcher, oba naraz,
   * komentarz w kodzie: „additive next to the existing per-tab CTA"), ma
   * pierwszeństwo nad `primaryCta`. Świadome odstępstwo od „primaryCta =
   * JEDEN" — cel: 1:1 zgodność z dotychczasowym `ModuleHub` przy migracji,
   * nie nowy, sankcjonowany wzorzec do kopiowania gdzie indziej.
   */
  primaryCtaContent?: React.ReactNode;
  /** Segment przełącznika widoków (ikony); pojedynczy tryb ukrywa segment. */
  viewModes?: ViewMode[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  /** Ewentualne dodatkowe filtry — na lewo od przełącznika widoków. */
  filterControls?: React.ReactNode;
  /** Alternatywa dla `primaryCta` — zgodność wywołań 1:1 z `ModuleHub` (Assessment-style). */
  onNewItem?: () => void;
  newItemLabel?: string;
  newItemTestId?: string;
  /** Discovery-Tools-style: 4 przyciski kategorii zamiast pigułek `tabs`. */
  categoryButtons?: CategoryButton[];
  /** Status po lewej (Initiatives/Execution/Audits) — przyciski albo dropdown. */
  statusFilters?: StatusFilter[];
  activeStatusFilter?: string | null;
  onStatusFilterChange?: (status: string | null) => void;
  statusDropdownContext?:
    | 'initiatives'
    | 'execution'
    | 'benefits'
    | 'assessment'
    | 'assessment_list'
    | 'assessment_reports'
    | 'tools';
  statusCounts?: Record<string, number>;
  /** Domyślnie false (KANON v3: bez liczników na głównych pigułkach). */
  showTabCounts?: boolean;
  toolControl?: React.ReactNode;
  aiControl?: React.ReactNode;

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

  /**
   * ★ Luk ucieczkowy dla hubów jeszcze nie wyrażonych przez `chips`/`bulk`
   * (dziś większość — zob. audyt 2026-07-26). Gdy podane, ma pierwszeństwo
   * nad `chips`/`bulk` i jest przekazywane 1:1 do `ModuleNavBar`, DOKŁADNIE
   * jak dziś robi to `ModuleHub`. Docelowo do wygaszenia na rzecz `chips`/`bulk`
   * hub po hubie — nie jest to trwały, sankcjonowany kanał.
   */
  commandRowContent?: React.ReactNode;
  commandRowRightContent?: React.ReactNode;
  forceCommandRow?: boolean;

  className?: string;
  /**
   * Gdy podane — fasada PRZEJMUJE TEŻ layout treści (flex-col h-full +
   * scrollowalny content area), bajt w bajt jak dzisiejszy `ModuleHub`
   * (`<ModuleHub>{children}</ModuleHub>` → `<StandardModuleBar>{children}</StandardModuleBar>`).
   * Bez tego propa (obecni konsumenci peryferyjni: MyProjects, AssessmentTable,
   * ReportBuilder, SuperAdmin, vault, AgentHubShell) fasada renderuje
   * WYŁĄCZNIE pasek, zachowanie sprzed tej zmiany — zero różnicy.
   */
  children?: React.ReactNode;
}

export const StandardModuleBar: React.FC<StandardModuleBarProps> = ({
  breadcrumbs,
  breadcrumbCta,
  breadcrumbExtra,
  tabs,
  activeTab,
  onTabChange,
  onSearch,
  searchValue,
  primaryCta,
  primaryCtaContent,
  viewModes,
  viewMode = 'table',
  onViewModeChange,
  filterControls,
  onNewItem,
  newItemLabel,
  newItemTestId,
  categoryButtons,
  statusFilters,
  activeStatusFilter,
  onStatusFilterChange,
  statusDropdownContext,
  statusCounts,
  showTabCounts,
  toolControl,
  aiControl,
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
  commandRowContent: commandRowOverride,
  commandRowRightContent: commandRowRightOverride,
  forceCommandRow: forceCommandRowOverride,
  className,
  children,
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
      <Menu3BulkRow
        selectedLabel={bulk!.selectedLabel ?? `${bulk!.count} selected`}
        selectAllLabel={bulk!.selectAllLabel}
        clearLabel={bulk!.clearLabel ?? 'Clear'}
        onSelectAll={bulk!.onSelectAll}
        onClear={bulk!.onClear ?? noop}
        actions={bulk!.actions}
      />
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

  // Luk ucieczkowy: gdy hub podaje surowy `commandRowContent`, ma pierwszeństwo
  // nad wyliczonym `chips`/`bulk` — 1:1 z dotychczasowym zachowaniem `ModuleHub`.
  const hasOverride = commandRowOverride !== undefined;
  const resolvedCommandRowContent = hasOverride
    ? commandRowOverride
    : bulkActive
      ? bulkContent
      : chipsContent;
  const resolvedCommandRowRight = hasOverride
    ? commandRowRightOverride
    : bulkActive
      ? undefined
      : menu3Right;
  const resolvedForceCommandRow = hasOverride ? !!forceCommandRowOverride : bulkActive;

  const primaryCtaNode = primaryCta ? (
    <button
      type="button"
      onClick={primaryCta.onClick}
      title={primaryCta.locked ? primaryCta.lockedReason : undefined}
      data-testid={primaryCta.testId}
      className={primaryCta.locked ? MENU_1_PRIMARY_CTA_LOCKED : MENU_1_PRIMARY_CTA}
    >
      {primaryCta.icon ? <primaryCta.icon size={16} /> : null}
      <span>{primaryCta.label}</span>
    </button>
  ) : undefined;

  const barContent = (
    <>
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
          {breadcrumbCta || breadcrumbExtra ? (
            <div className="flex shrink-0 items-center gap-2">
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
              {breadcrumbExtra}
            </div>
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
        primaryCta={primaryCtaContent !== undefined ? primaryCtaContent : primaryCtaNode}
        openDocuments={openItems ?? []}
        activeDocumentId={activeItemId ?? null}
        onSelectDocument={onSelectItem ?? noop}
        onCloseDocument={onCloseItem ?? noop}
        onShowList={onShowList ?? noop}
        activeFilters={activeFilters ?? []}
        onRemoveFilter={onRemoveFilter ?? noop}
        onClearFilters={onClearFilters ?? noop}
        forceCommandRow={resolvedForceCommandRow}
        commandRowContent={resolvedCommandRowContent}
        commandRowRightContent={resolvedCommandRowRight}
        onNewItem={onNewItem}
        newItemLabel={newItemLabel}
        newItemTestId={newItemTestId}
        categoryButtons={categoryButtons}
        statusFilters={statusFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusDropdownContext={statusDropdownContext}
        statusCounts={statusCounts}
        showTabCounts={showTabCounts}
        toolControl={toolControl}
        aiControl={aiControl}
      />
    </>
  );

  // Bez `children`: zachowanie sprzed tej zmiany — wyłącznie pasek (peryferyjni
  // konsumenci: MyProjects, AssessmentTable, ReportBuilder, SuperAdmin, vault, AgentHubShell).
  if (children === undefined) {
    return <div className={className}>{barContent}</div>;
  }

  // Z `children`: pełny layout 1:1 z `ModuleHub` (flex-col h-full + scrollowalny content area).
  return (
    <div
      className={['flex flex-col h-full bg-c-bg text-c-text', className].filter(Boolean).join(' ')}
    >
      {barContent}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
};

export default StandardModuleBar;
