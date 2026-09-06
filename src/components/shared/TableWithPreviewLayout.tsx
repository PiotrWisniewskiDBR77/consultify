/**
 * TableWithPreviewLayout — V3-C01 / V3-A07
 *
 * Reusable layout: table (left) + preview pane (right, Outlook-style).
 * Uses PreviewPaneShell from ui/ResizableTable.
 *
 * Interactions (KANON v3):
 * - Single click → selection + preview (no navigation)
 * - Double-click / Enter → open full detail
 * - J/K → navigate rows, update preview
 * - Esc → close preview
 * - Preview default OFF (opens on first click)
 *
 * SSOT: docs/ui-standards/03-modules/table-preview-pane-standard.md
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PREVIEW_HEADER_ICON_BUTTON,
  PREVIEW_HEADER_ICON_BUTTON_ACTIVE,
  PREVIEW_HEADER_ICON_SIZE,
  PREVIEW_HEADER_OPEN_BUTTON,
} from '@/components/shared/PreviewPane/previewStyles';
import { PREVIEW_PANE_WIDTH } from '@/components/shared/PreviewPane/previewGeometry';
import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import { useDeviceType } from '@/hooks/useDeviceType';
import type { WorkspaceContext } from '@/types/workspace';

import { registerEmbeddedModuleChatHost } from './embeddedModuleChatHost';
import { useJedenPanel } from './PreviewPane/useJedenPanel';

const PANEL_INLINE_CONTAINER_WIDTH = 1184;
const PANEL_RESIZE_HYSTERESIS = 24;

export interface PreviewableItem {
  id: string;
  title: string;
}

export interface TableWithPreviewLayoutProps<T extends PreviewableItem> {
  /** The table content (rendered as children) */
  children: React.ReactNode;
  /** Currently selected item id */
  selectedId: string | null;
  /** Currently selected item data */
  selectedItem: T | null;
  /** Called when selection changes (single click) */
  onSelect: (id: string | null) => void;
  /** Called when full detail should open (double-click / Enter) */
  onOpenFull?: (id: string) => void;
  /**
   * Odbiór 141-plan-scenario (2026-08-31) — prop ADDYTYWNY, lustro kontraktu
   * `StandardPreview.openDisabledReason` (FIX-1, dyżur 26 chat-signals-front).
   *
   * Ten layout, a nie `StandardPreview`, rysuje nagłówek podglądu w trybie
   * `embedded` — więc bez tego propu powierzchnia bez destynacji ma tylko dwa
   * wyjścia: przycisk „Otwórz" prowadzący w złe miejsce albo BRAK przycisku
   * (milczenie o istnieniu obiektu). Podany BEZ `onOpenFull` renderuje
   * WYŁĄCZONY „Otwórz" z tym powodem w tooltipie. Gdy `onOpenFull` jest
   * podany, prop jest ignorowany. Brak obu ⇒ zero zmian (przycisku nie ma).
   */
  openDisabledReason?: string;
  /** Render the preview body */
  renderPreview: (item: T) => React.ReactNode;
  /** Render preview footer quick actions */
  renderPreviewFooter?: (item: T) => React.ReactNode;
  /** Render preview header actions (before close button) */
  renderPreviewActions?: (item: T) => React.ReactNode;
  /** List of item IDs for J/K navigation */
  itemIds?: string[];
  /** Whether the preview pane is visible */
  previewOpen?: boolean;
  /** Whether preview should auto-open on first selection (default: true) */
  autoOpenPreview?: boolean;
  /** Single-key action shortcuts dispatched when preview is open (key → handler). Keys should match ActionButton.shortcut values. */
  actionShortcuts?: Record<string, () => void>;
  /** Multi-select IDs — when size > 1, renders batch panel instead of single-item preview */
  selectedIds?: Set<string>;
  /** Render batch operations panel when multiple items are selected */
  renderBatchPreview?: (ids: Set<string>) => React.ReactNode;
  /** Lookup function to resolve item by ID — required for pinning to render the pinned item */
  getItemById?: (id: string) => T | null;
  /**
   * Desktop preview overlay (#4b) — when true, on ≥lg the preview pane floats as a
   * fixed/absolute panel anchored to the right edge INSTEAD of a flex sibling, so the
   * table/card grid keeps full width (zero reflow). Mobile is unchanged (already an overlay).
   * Default false → existing flex-sibling behaviour for every other consumer.
   */
  desktopPreviewOverlay?: boolean;
  /** Render the selected entity as the main full-width card instead of table + preview. */
  fullView?: boolean;
  /**
   * ★ DEC-404: zachowane wyłącznie po to, by wołacze nie musiały zmieniać
   * kształtu wywołania. Panel podglądu NIE renderuje już Teresy — Teresa ma
   * jedną postać (standardowy dok `MainLayout`), a dok zastępuje tę kolumnę.
   * `wylacz: true` nadal znaczy „ten ekran nie melduje się jako gospodarz P1",
   * czyli w Menu 3 nie pojawi się pigułka „Pokaż panel".
   */
  teresa?: { kontekst?: WorkspaceContext; wylacz?: boolean };
}

export function TableWithPreviewLayout<T extends PreviewableItem>({
  children,
  selectedId,
  selectedItem,
  onSelect,
  onOpenFull,
  openDisabledReason,
  renderPreview,
  renderPreviewFooter,
  renderPreviewActions,
  itemIds = [],
  previewOpen: controlledPreviewOpen,
  autoOpenPreview = true,
  actionShortcuts,
  selectedIds,
  renderBatchPreview,
  getItemById,
  desktopPreviewOverlay = false,
  fullView = false,
  teresa,
}: TableWithPreviewLayoutProps<T>) {
  const { t } = useTranslation();
  const { isMobile, safeAreaInsets } = useDeviceType();
  // #4b — desktop overlay: float the preview above the table (no reflow). Never on mobile
  // (mobile already renders a full-screen `fixed inset-0` drawer below).
  const [automatycznaNakladka, setAutomatycznaNakladka] = useState(false);
  const overlayMode = (desktopPreviewOverlay || automatycznaNakladka) && !isMobile;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const jedenPanel = useJedenPanel();
  const teresaWlaczona = teresa?.wylacz !== true;

  useEffect(() => {
    if (!teresaWlaczona || fullView) return;
    return registerEmbeddedModuleChatHost();
  }, [fullView, teresaWlaczona]);

  useEffect(() => {
    const kontener = containerRef.current;
    if (!kontener || typeof ResizeObserver === 'undefined') return;

    let zainicjalizowany = false;
    const obserwator = new ResizeObserver(([wpis]) => {
      if (!wpis) return;
      const szerokosc = wpis.contentRect.width;
      setAutomatycznaNakladka((poprzednia) => {
        if (!zainicjalizowany) {
          zainicjalizowany = true;
          return szerokosc < PANEL_INLINE_CONTAINER_WIDTH;
        }
        if (poprzednia) return szerokosc < PANEL_INLINE_CONTAINER_WIDTH;
        return szerokosc < PANEL_INLINE_CONTAINER_WIDTH - PANEL_RESIZE_HYSTERESIS;
      });
    });
    obserwator.observe(kontener);
    return () => obserwator.disconnect();
  }, []);

  /*
   * ★ DEC-404: efekt „nowe zaznaczenie wraca na zakładkę Rekord" (wraz z refem
   * `poprzednieZaznaczenie`) zniknął razem z samą zakładką — panel podglądu
   * pokazuje wyłącznie rekord, więc nie ma z czego wracać.
   */

  // [ODMROZENIE 07_MY_WORK_AGENT DEC-397] USUNIĘTE: efekt wołał
  // `jedenPanel.pokazPanel()` na KAŻDE przejście `controlledPreviewOpen`
  // false→true — czyli też na zwykły klik w kolejny wiersz po świadomym
  // zamknięciu (X), bo konsumenci kontrolowani (np. `MyTasksListContent`,
  // `ExecutionHub`) czyszczą swój lokalny stan na `null` przy zamknięciu i
  // ustawiają go ponownie na klik wiersza — co jest DOKŁADNIE tym samym
  // false→true przejściem. Efekt bezwarunkowo kasował `zamkniety`, więc
  // panel wracał mimo X (regresja uwagi właściciela „nie mogę go zamknąć").
  // `panelWidoczny` niżej już poprawnie liczy widoczność z
  // `!jedenPanel.zamkniety && isPreviewOpen && !!selectedItem` — nie
  // potrzebuje tego efektu, żeby otworzyć panel przy PIERWSZYM zaznaczeniu
  // (zamkniety zaczyna jako `false`, dopóki nikt świadomie nie zamknie).
  // Jawne przywrócenie panelu idzie wyłącznie przez pigułkę „Pokaż panel"/
  // „Teresa" w Menu 3 (`StandardModuleBar.tsx`, `jedenPanel.pokazPanel`/
  // `otworzTerese` wprost), zgodnie z kanonem P1 §4.1 (dok
  // `docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md`).
  // Test: `jedenPanel.contract.test.tsx` T4 (mutacja: przywróć efekt → pada).

  /*
   * ★ DEC-397b (właściciel, 06.09.2026 15:47) — NADPISUJE DEC-397 z komentarza
   * wyżej. Uwaga właściciela (lista Inicjatyw, panel wcześniej zamknięty):
   * „Jest preview, ale nie otwiera mi się z poziomu klikanej linii (…) działa
   * przy pojedynczym kliknięciu na linię". Efekt USUNIĘTY wyżej (07_MY_WORK_
   * AGENT) gasił się celowo na KAŻDE `controlledPreviewOpen` false→true —
   * także bierne re-rendery. Ten efekt jest węższy: patrzy WYŁĄCZNIE na
   * `selectedId` (identyfikator, nie treść) i odpala się TYLKO gdy ta wartość
   * naprawdę się zmienia na nową, niepustą — czyli na faktyczny klik innego
   * wiersza (albo J/K, albo „wstecz/dalej" w historii — to też świadomy wybór
   * użytkownika). Bierny re-render z tym samym `selectedId` (nowe dane pod
   * spodem, przełączenie zakładki) nic tu nie zmienia — `poprzedniSelectedId`
   * startuje z bieżącej wartości, więc PIERWSZE odpalenie po mount też jest
   * cichym no-op. `otworz()` (w odróżnieniu od `pokazPanel()`) NIE zwija doku
   * Teresy — gdy dok jest otwarty (DEC-404), klik wiersza nie ma otwierać
   * drugiego panelu w tej samej kolumnie; widoczność nadal gate'uje
   * `!jedenPanel.dokOtwarty` niżej.
   * Test: `jedenPanel.contract.test.tsx` T4 (mutacja: usuń wywołanie
   * `otworz()` → RED), T2b (dok otwarty + klik → RED, gdyby otwierał drugi
   * panel).
   */
  const poprzedniSelectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => {
    const poprzedni = poprzedniSelectedIdRef.current;
    poprzedniSelectedIdRef.current = selectedId;
    if (selectedId && selectedId !== poprzedni) {
      jedenPanel.otworz();
    }
  }, [selectedId, jedenPanel]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const isPreviewOpen = controlledPreviewOpen ?? internalPreviewOpen;
  /*
   * ★ DEC-404: dok Teresy ZASTĘPUJE kolumnę podglądu (`jedenPanel.dokOtwarty`).
   * `zamkniety` zostaje nietknięty, więc po zamknięciu doku podgląd wraca
   * dokładnie w stanie sprzed otwarcia. Dzięki temu na ekranie nadal jest
   * dokładnie jeden `<aside>` i jeden `UnifiedChatPanel`.
   */
  const panelWidoczny =
    !jedenPanel.zamkniety && !jedenPanel.dokOtwarty && isPreviewOpen && !!selectedItem;
  const isBatchMode = (selectedIds?.size ?? 0) > 1 && !!renderBatchPreview;

  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const pinnedItem = pinnedId && getItemById ? getItemById(pinnedId) : null;

  const handlePin = useCallback(() => {
    if (pinnedId === selectedId) {
      setPinnedId(null);
    } else {
      setPinnedId(selectedId);
    }
  }, [pinnedId, selectedId]);

  const handleUnpin = useCallback(() => setPinnedId(null), []);

  const MAX_HISTORY = 10;
  const [historyBack, setHistoryBack] = useState<string[]>([]);
  const [historyForward, setHistoryForward] = useState<string[]>([]);
  const isHistoryNav = useRef(false);

  const pushHistory = useCallback((prevId: string) => {
    if (isHistoryNav.current) return;
    setHistoryBack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), prevId]);
    setHistoryForward([]);
  }, []);

  const goBack = useCallback(() => {
    if (!historyBack.length) return;
    const prevId = historyBack[historyBack.length - 1];
    setHistoryBack((prev) => prev.slice(0, -1));
    if (selectedId) setHistoryForward((prev) => [...prev, selectedId]);
    isHistoryNav.current = true;
    onSelect(prevId);
    requestAnimationFrame(() => {
      isHistoryNav.current = false;
    });
  }, [historyBack, selectedId, onSelect]);

  const goForward = useCallback(() => {
    if (!historyForward.length) return;
    const nextId = historyForward[historyForward.length - 1];
    setHistoryForward((prev) => prev.slice(0, -1));
    if (selectedId) setHistoryBack((prev) => [...prev, selectedId]);
    isHistoryNav.current = true;
    onSelect(nextId);
    requestAnimationFrame(() => {
      isHistoryNav.current = false;
    });
  }, [historyForward, selectedId, onSelect]);

  // If selection is controlled externally (row click sets selectedId),
  // keep internal preview open state in sync (KANON: single click opens preview).
  useEffect(() => {
    // When previewOpen is controlled from outside, don't fight it.
    if (controlledPreviewOpen !== undefined) return;
    if (!autoOpenPreview) return;

    if (selectedId) {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== containerRef.current &&
        containerRef.current?.contains(document.activeElement) &&
        !document.activeElement.closest('[data-preview-pane]')
      ) {
        returnFocusRef.current = document.activeElement;
      }
      setInternalPreviewOpen(true);
    } else {
      setInternalPreviewOpen(false);
    }
  }, [selectedId, controlledPreviewOpen, autoOpenPreview]);

  const handleSelect = useCallback(
    (id: string) => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== containerRef.current &&
        containerRef.current?.contains(document.activeElement)
      ) {
        returnFocusRef.current = document.activeElement;
      }
      if (selectedId && selectedId !== id) pushHistory(selectedId);
      onSelect(id);
      if (autoOpenPreview) {
        setInternalPreviewOpen(true);
      }
    },
    [onSelect, autoOpenPreview, selectedId, pushHistory]
  );

  const handleClose = useCallback(() => {
    setInternalPreviewOpen(false);
    jedenPanel.zamknij();
    onSelect(null);
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    if (opener?.isConnected) {
      opener.focus();
    } else {
      containerRef.current?.focus();
    }
  }, [jedenPanel, onSelect]);

  useEffect(() => {
    const dialog = mobileDialogRef.current;
    if (!isMobile || !isPreviewOpen || !dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
    (focusable()[0] ?? dialog).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', trap);
    return () => dialog.removeEventListener('keydown', trap);
  }, [isMobile, isPreviewOpen, selectedId]);

  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if (!itemIds.length && !actionShortcuts) return;

      const currentIdx = selectedId ? itemIds.indexOf(selectedId) : -1;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          if (isInput) return;
          e.preventDefault();
          const nextIdx = Math.min(currentIdx + 1, itemIds.length - 1);
          if (itemIds[nextIdx]) handleSelect(itemIds[nextIdx]);
          break;
        }
        case 'k':
        case 'ArrowUp': {
          if (isInput) return;
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          if (itemIds[prevIdx]) handleSelect(itemIds[prevIdx]);
          break;
        }
        case 'Enter': {
          if (!isInput && selectedId && onOpenFull) {
            e.preventDefault();
            onOpenFull(selectedId);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          handleClose();
          break;
        }
        case 'ArrowLeft': {
          if (e.altKey && !isInput) {
            e.preventDefault();
            goBack();
          }
          break;
        }
        case 'ArrowRight': {
          if (e.altKey && !isInput) {
            e.preventDefault();
            goForward();
          }
          break;
        }
        default: {
          if (isInput || !isPreviewOpen || !actionShortcuts) break;
          const handler = actionShortcuts[e.key] ?? actionShortcuts[e.key.toUpperCase()];
          if (handler) {
            e.preventDefault();
            handler();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [
    itemIds,
    selectedId,
    handleSelect,
    handleClose,
    onOpenFull,
    isPreviewOpen,
    actionShortcuts,
    goBack,
    goForward,
  ]);

  const previewActions = !isBatchMode ? (
      <>
        {selectedItem &&
        (historyBack.length > 0 || historyForward.length > 0) ? (
          <div className="flex items-center gap-0.5 mr-1">
            <button
              onClick={goBack}
              disabled={!historyBack.length}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-30"
              title="Alt+←"
              aria-label={t('common.back', 'Back')}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={goForward}
              disabled={!historyForward.length}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-30"
              title="Alt+→"
              aria-label={t('common.forward', 'Forward')}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
        {selectedItem && getItemById && !isMobile ? (
          <button
            onClick={handlePin}
            className={
              pinnedId === selectedItem.id
                ? PREVIEW_HEADER_ICON_BUTTON_ACTIVE
                : PREVIEW_HEADER_ICON_BUTTON
            }
            title={pinnedId === selectedItem.id ? 'Unpin' : 'Pin for comparison'}
            aria-label={pinnedId === selectedItem.id ? 'Unpin' : 'Pin for comparison'}
          >
            {pinnedId === selectedItem.id ? (
              <PinOff size={PREVIEW_HEADER_ICON_SIZE} />
            ) : (
              <Pin size={PREVIEW_HEADER_ICON_SIZE} />
            )}
          </button>
        ) : null}
        {selectedItem ? renderPreviewActions?.(selectedItem) : null}
        {selectedItem && onOpenFull && (
          <button
            onClick={() => onOpenFull(selectedItem.id)}
            /* §7.3 pkt 1 — ten sam pill co w `StandardPreview` (wspólne klasy
               z `previewStyles.ts`). Poprzednio focus ring był
               crimsonowy pierscien fokusa z rodziny primary — kanon wymaga `c-focus`. */
            className={PREVIEW_HEADER_OPEN_BUTTON}
            title={t('common.open', 'Open')}
          >
            <span>{t('common.open', 'Open')}</span>
          </button>
        )}
        {selectedItem && !onOpenFull && openDisabledReason && (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className={PREVIEW_HEADER_OPEN_BUTTON}
            title={openDisabledReason}
          >
            <span>{t('common.open', 'Open')}</span>
          </button>
        )}
      </>
    ) : null;

  const trescPanelu = selectedItem ? renderPreview(selectedItem) : null;

  const tytulPanelu = selectedItem?.title ?? t('list.rightPanel.tabRecord', 'Record');

  if (fullView && selectedItem) {
    return (
      <div
        className="app-table-scrollbar h-full min-h-0 overflow-y-auto bg-c-bg p-4"
        role="region"
        aria-label={t('common.fullCard', 'Full card')}
      >
        <div className="mx-auto w-full max-w-6xl space-y-4">
          {renderPreview(selectedItem)}
          {renderPreviewFooter ? (
            <div className="sticky bottom-0 rounded-xl border border-c-border bg-c-surface/95 p-3 shadow-lg backdrop-blur">
              {renderPreviewFooter(selectedItem)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full overflow-hidden gap-1.5"
      tabIndex={0}
      role="region"
      aria-label={t('common.tableWithPreview', 'Table and preview workspace')}
    >
      {/* Table area */}
      <div
        className="app-table-scrollbar flex-1 min-w-0 overflow-auto pr-2 [scrollbar-gutter:stable]"
        style={{ scrollbarGutter: 'stable' }}
      >
        {children}
      </div>

      {/* Preview panels — by default inline flex siblings (display:contents keeps the wrapper
          layout-transparent, identical to the previous behaviour). When desktopPreviewOverlay is
          on (#4b), the wrapper becomes a right-edge floating overlay so the table keeps full width
          (zero reflow). Mobile branches inside stay `fixed inset-0` regardless. */}
      <div
        className={
          overlayMode
            ? 'pointer-events-none absolute inset-y-0 right-0 z-40 flex items-stretch justify-end gap-1.5 pl-3'
            : 'contents'
        }
      >
        {/* Pinned preview pane (comparison mode) */}
        {pinnedItem && pinnedId !== selectedId && isPreviewOpen && !isBatchMode && !isMobile ? (
          <motion.div
            key={`pinned-${pinnedId}`}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
            className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3 pointer-events-auto"
            data-preview-pane
            style={{ width: 'clamp(280px, 22%, 400px)' }}
          >
            <PreviewPaneShell
              title={pinnedItem.title}
              onClose={handleUnpin}
              className={overlayMode ? 'h-full rounded-2xl shadow-2xl !bg-c-surface' : undefined}
              actions={
                <button
                  onClick={handleUnpin}
                  /* Było crimsonowy tekst i tlo z rodziny primary na kontrolce
                     stanu (pułapka nr 1 z CLAUDE.md). Stan aktywny pinezki ma
                     akcent `--c-info`, ten sam co w nagłówku obok. */
                  className={PREVIEW_HEADER_ICON_BUTTON_ACTIVE}
                  title="Unpin"
                  aria-label="Unpin"
                >
                  <PinOff size={PREVIEW_HEADER_ICON_SIZE} />
                </button>
              }
            >
              {renderPreview(pinnedItem)}
            </PreviewPaneShell>
          </motion.div>
        ) : null}

        {/* Preview pane — 20-33% width, min 340px, clamp() for responsiveness */}
        <AnimatePresence mode="wait">
          {isMobile && isBatchMode && renderBatchPreview ? (
            <motion.div
              key="mobile-batch"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="fixed inset-0 z-[70]"
              data-testid="mobile-preview-overlay"
              data-preview-pane
              ref={mobileDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('common.batchOperations', 'Batch Operations')}
              tabIndex={-1}
            >
              <button
                type="button"
                onClick={handleClose}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                aria-label={t('common.close', 'Close')}
                data-testid="mobile-preview-backdrop"
              />
              <div
                className="relative h-full p-3"
                style={{
                  paddingTop: Math.max(12, safeAreaInsets.top || 0),
                  paddingBottom: Math.max(12, safeAreaInsets.bottom || 0),
                }}
              >
                <PreviewPaneShell
                  title={t('common.batchOperations', 'Batch Operations')}
                  onClose={handleClose}
                  className="h-full rounded-2xl shadow-2xl"
                >
                  {renderBatchPreview(selectedIds!)}
                </PreviewPaneShell>
              </div>
            </motion.div>
          ) : isMobile && panelWidoczny ? (
            <motion.div
              key={`mobile-${selectedItem?.id ?? 'rekord'}`}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="fixed inset-0 z-[70]"
              data-testid="mobile-preview-overlay"
              data-preview-pane
              ref={mobileDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={tytulPanelu}
              tabIndex={-1}
            >
              <button
                type="button"
                onClick={handleClose}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                aria-label={t('common.close', 'Close')}
                data-testid="mobile-preview-backdrop"
              />
              <div
                className="relative h-full p-3"
                style={{
                  paddingTop: Math.max(12, safeAreaInsets.top || 0),
                  paddingBottom: Math.max(12, safeAreaInsets.bottom || 0),
                }}
              >
                <PreviewPaneShell
                  title={tytulPanelu}
                  onClose={handleClose}
                  closeLabel={t('list.rightPanel.close', 'Close panel')}
                  actions={previewActions}
                  footer={selectedItem ? renderPreviewFooter?.(selectedItem) : undefined}
                  className="h-full rounded-2xl shadow-2xl"
                >
                  {trescPanelu}
                </PreviewPaneShell>
              </div>
            </motion.div>
          ) : isBatchMode && renderBatchPreview ? (
            <motion.div
              key="batch"
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3 pointer-events-auto"
              data-preview-pane
              style={{ width: PREVIEW_PANE_WIDTH }}
            >
              <PreviewPaneShell
                title={t('common.batchOperations', 'Batch Operations')}
                onClose={handleClose}
                className={overlayMode ? 'h-full rounded-2xl shadow-2xl !bg-c-surface' : undefined}
              >
                {renderBatchPreview(selectedIds!)}
              </PreviewPaneShell>
            </motion.div>
          ) : panelWidoczny ? (
            /* DEC-404: ten JEDEN prawy panel jest tym samym bytem co
               `<aside data-right-panel>` w `JedenPrawyPanel` — element
               semantyczny musi być ten sam, żeby bramka „dokładnie jeden
               <aside>" mierzyła to samo w obu rodzinach ekranów listowych
               (zmierzone 06.09: Pomysły/Zadania/Inicjatywy dawały aside=0
               przy widocznym panelu, bo tu stał `div`). Sam znacznik — zero
               zmiany klas, stylu i zachowania. */
            <motion.aside
              key={selectedItem?.id ?? 'rekord'}
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3 pointer-events-auto"
              data-preview-pane
              data-right-panel
              style={{ width: PREVIEW_PANE_WIDTH }}
            >
              <PreviewPaneShell
                title={tytulPanelu}
                onClose={handleClose}
                closeLabel={t('list.rightPanel.close', 'Close panel')}
                actions={previewActions}
                footer={selectedItem ? renderPreviewFooter?.(selectedItem) : undefined}
                className={overlayMode ? 'h-full rounded-2xl shadow-2xl !bg-c-surface' : undefined}
              >
                {trescPanelu}
              </PreviewPaneShell>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TableWithPreviewLayout;
