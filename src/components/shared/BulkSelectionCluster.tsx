/**
 * BulkSelectionCluster — JEDEN kanoniczny model i renderer klastra selection.
 *
 * ── R02-B (wąski, bezkolizyjny etap pakietu R02) ────────────────────────────
 *
 * Kontrakt normatywny: `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`
 * §4 Formuła 2 (bulk). Kontrakt maszynowy: `src/contracts/tableSurface` (R00).
 *
 * PO CO ISTNIEJE. W repo żyły DWIE równoległe implementacje tego samego paska
 * bulk, każda z własnym Clear:
 *
 *   · `ui/ResizableTable/BulkActionBar` — pływający pill na dole ekranu; Clear
 *     jako ikona X wewnątrz ramki licznika; akcje `px-3 py-1.5`; overflow „More";
 *     JEDEN żywy konsument (`MyWork/NotificationsContent`);
 *   · `shared/ModuleHub/BulkActionBar` — pasek inline; Clear jako tekstowy link
 *     dosunięty `ml-auto` do prawej, BEZ ikony X; akcje `h-8 rounded-full`;
 *     ZERO konsumentów JSX.
 *
 * `REPAIR_WORK_PACKAGES.csv` (R02) mówi wprost: „Must remove parallel Clear
 * implementations". Ten plik jest tym jednym miejscem — obie powłoki renderują
 * odtąd tę samą zawartość, zachowując własne API i własne umiejscowienie.
 *
 * CZEGO TEN PLIK NIE ROBI. Nie jest kanonicznym rzędem Menu 3 — `Menu3BulkRow`
 * w `ModuleMenu3.tsx` powstaje równolegle w R02-A i jest cudzą własnością.
 * R02-B ujednolica wyłącznie ZAWARTOŚĆ klastra (licznik, Select all, X + Clear,
 * akcje, kolory, stany, klawiatura). Umiejscowienie zostaje takie, jakie było
 * w każdej z powłok — przeniesienie bulk do Menu 3 należy do R02-A.
 *
 * @module components/shared/BulkSelectionCluster
 */

import { X } from 'lucide-react';
import React, { useCallback, useMemo, useRef } from 'react';

/**
 * Kanoniczny model akcji bulk.
 *
 * `icon` jest `ReactNode`, a nie `LucideIcon`, bo obie powłoki podają go inaczej:
 * fabryki `createTaskBulkActions`/`createNotificationBulkActions` przekazują
 * gotowy element (`<CheckCircle size={16} />`), a `ModuleHub` przekazywał
 * komponent. `ReactNode` przyjmuje jedno i drugie bez zmiany API po stronie
 * biznesowej — a to był warunek brzegowy R02-B.
 */
export interface BulkClusterAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  /**
   * §4/§9: czerwony jest zarezerwowany dla danger. Wariantów są DWA — nie ma
   * `primary`, bo pasek bulk nie ma akcji wyróżnionej kolorem.
   */
  variant?: 'neutral' | 'danger';
  /**
   * Wyłączona pozycja pozostaje WIDOCZNA i wyraźnie jaśniejsza. Powód NIE jest
   * prezentowany — decyzja zarządzająca R01 (2026-08-06), nadrzędna wobec
   * P-17/P-18, ta sama reguła co w menu wiersza.
   */
  disabled?: boolean;
}

export interface BulkSelectionClusterProps {
  /** Liczba zaznaczonych. Klaster renderuje się wyłącznie gdy > 0 (§4 Formuła 2). */
  count: number;
  /** Gotowa etykieta „N selected"; domyślnie budowana z `count`. */
  selectedLabel?: React.ReactNode;
  /** Opcjonalne `Select all` (§4 Formuła 2 — „opcjonalne"). */
  onSelectAll?: () => void;
  selectAllLabel?: React.ReactNode;
  /** Clear jest OBOWIĄZKOWY — typ nie dopuszcza jego braku. */
  onClear: () => void;
  clearLabel?: React.ReactNode;
  actions: BulkClusterAction[];
  className?: string;
  /**
   * Wariant powłoki. `strip` to pasek inline (pełna szerokość), `floating` to
   * zawartość pływającego pilla. Różnią się WYŁĄCZNIE tłem/obramowaniem grupy
   * licznika — kolejność, kształty i stany są identyczne.
   */
  tone?: 'strip' | 'floating';
}

/** §10: przycisk bulk ma 32 px (`h-8`), nie 36. */
const ACTION_BASE =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

const ACTION_NEUTRAL = 'border-c-border-subtle text-c-text hover:bg-state-hover';

/** §9: czerwony wyłącznie dla danger. */
const ACTION_DANGER = 'border-c-danger/30 text-c-danger hover:bg-c-danger/10 dark:text-danger-400';

/**
 * Klaster selection w kanonicznej kolejności (§4 Formuła 2):
 * `N selected` → `Select all` → `Clear` (z X) → akcje wspólne → danger na końcu.
 *
 * Danger jest sortowany na koniec TUTAJ, a nie u wywołującego — inaczej każda
 * z 3 fabryk musiałaby pamiętać o kolejności osobno, a `createTaskBulkActions`
 * już dziś zwraca Delete na końcu tylko przez przypadek kolejności literałów.
 */
export const BulkSelectionCluster: React.FC<BulkSelectionClusterProps> = ({
  count,
  selectedLabel,
  onSelectAll,
  selectAllLabel = 'Select all',
  onClear,
  clearLabel = 'Clear',
  actions,
  className = '',
  tone = 'strip',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const orderedActions = useMemo(() => {
    const danger = actions.filter((a) => a.variant === 'danger');
    const neutral = actions.filter((a) => a.variant !== 'danger');
    return [...neutral, ...danger];
  }, [actions]);

  /**
   * Klawiatura (§7 stosowane spójnie w całym kanonie): strzałki i Home/End
   * poruszają się po realnych, włączonych kontrolkach paska. Pozycje wyłączone
   * są widoczne, ale pomijane — tak samo jak w menu wiersza po R01.
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const root = containerRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();

    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowRight') next = current < 0 ? 0 : (current + 1) % items.length;
    else next = current <= 0 ? items.length - 1 : current - 1;

    items[next]?.focus();
  }, []);

  // §4 Formuła 2: pasek istnieje wyłącznie przy niepustym zaznaczeniu.
  if (count <= 0) return null;

  const counterGroup =
    tone === 'floating'
      ? 'flex items-center gap-2 pr-3 border-r border-c-border-subtle'
      : 'flex items-center gap-2';

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      role="group"
      aria-label="Bulk selection actions"
      data-bulk-selection-cluster={tone}
      className={[
        // Brak clippingu przy 1280×720: klaster zawija się, a przy bardzo wąskim
        // kontenerze przewija poziomo zamiast chować akcje poza krawędź.
        'flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto no-scrollbar',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={counterGroup}>
        <span
          data-bulk-selected-count
          className="inline-flex h-8 shrink-0 items-center whitespace-nowrap px-1 text-xs font-semibold text-c-text select-none"
        >
          {selectedLabel ?? `${count} selected`}
        </span>
      </div>

      {onSelectAll ? (
        <button type="button" onClick={onSelectAll} className={`${ACTION_BASE} ${ACTION_NEUTRAL}`}>
          {selectAllLabel}
        </button>
      ) : null}

      {/*
        Clear jest ZAWSZE obecny i ZAWSZE ma ikonę X (§4 Formuła 2). To jest ten
        jeden element, który wcześniej istniał w dwóch niezgodnych wariantach:
        ikona bez etykiety (pill) i etykieta bez ikony (pasek).
      */}
      <button
        type="button"
        onClick={onClear}
        data-bulk-clear
        className={`${ACTION_BASE} ${ACTION_NEUTRAL}`}
      >
        <X size={14} aria-hidden="true" />
        {clearLabel}
      </button>

      {orderedActions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => void action.onClick()}
          disabled={action.disabled}
          aria-disabled={action.disabled || undefined}
          className={`${ACTION_BASE} ${
            action.variant === 'danger' ? ACTION_DANGER : ACTION_NEUTRAL
          }`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default BulkSelectionCluster;
