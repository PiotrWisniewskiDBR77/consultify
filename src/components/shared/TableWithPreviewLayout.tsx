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

import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import { useDeviceType } from '@/hooks/useDeviceType';

export interface PreviewableItem {
  id: string;
  title: string;
}

interface TableWithPreviewLayoutProps<T extends PreviewableItem> {
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
}

export function TableWithPreviewLayout<T extends PreviewableItem>({
  children,
  selectedId,
  selectedItem,
  onSelect,
  onOpenFull,
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
}: TableWithPreviewLayoutProps<T>) {
  const { t } = useTranslation();
  const { isMobile, safeAreaInsets } = useDeviceType();
  // #4b — desktop overlay: float the preview above the table (no reflow). Never on mobile
  // (mobile already renders a full-screen `fixed inset-0` drawer below).
  const overlayMode = desktopPreviewOverlay && !isMobile;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
    onSelect(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [onSelect]);

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

  const previewActions =
    !isBatchMode && selectedItem ? (
      <>
        {historyBack.length > 0 || historyForward.length > 0 ? (
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
        {getItemById && !isMobile ? (
          <button
            onClick={handlePin}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
              pinnedId === selectedItem.id
                ? 'text-[var(--c-info)] bg-slate-100 dark:bg-white/[0.10]'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
            }`}
            title={pinnedId === selectedItem.id ? 'Unpin' : 'Pin for comparison'}
            aria-label={pinnedId === selectedItem.id ? 'Unpin' : 'Pin for comparison'}
          >
            {pinnedId === selectedItem.id ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        ) : null}
        {renderPreviewActions?.(selectedItem)}
        {onOpenFull && (
          <button
            onClick={() => onOpenFull(selectedItem.id)}
            className="inline-flex items-center h-9 px-4 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 text-xs font-medium"
            title={t('common.open', 'Open')}
          >
            <span>{t('common.open', 'Open')}</span>
          </button>
        )}
      </>
    ) : null;

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
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full text-primary-500 bg-primary-50 dark:bg-primary-500/10"
                  title="Unpin"
                  aria-label="Unpin"
                >
                  <PinOff size={14} />
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
          ) : isMobile && isPreviewOpen && selectedItem ? (
            <motion.div
              key={`mobile-${selectedItem.id}`}
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
              aria-label={selectedItem.title}
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
                  title={selectedItem.title}
                  onClose={handleClose}
                  actions={previewActions}
                  footer={renderPreviewFooter?.(selectedItem)}
                  className="h-full rounded-2xl shadow-2xl"
                >
                  {renderPreview(selectedItem)}
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
              style={{ width: 'clamp(340px, 28%, 480px)' }}
            >
              <PreviewPaneShell
                title={t('common.batchOperations', 'Batch Operations')}
                onClose={handleClose}
                className={overlayMode ? 'h-full rounded-2xl shadow-2xl !bg-c-surface' : undefined}
              >
                {renderBatchPreview(selectedIds!)}
              </PreviewPaneShell>
            </motion.div>
          ) : isPreviewOpen && selectedItem ? (
            <motion.div
              key={selectedItem.id}
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3 pointer-events-auto"
              data-preview-pane
              style={{ width: 'clamp(340px, 28%, 480px)' }}
            >
              <PreviewPaneShell
                title={selectedItem.title}
                onClose={handleClose}
                actions={previewActions}
                footer={renderPreviewFooter?.(selectedItem)}
                className={overlayMode ? 'h-full rounded-2xl shadow-2xl !bg-c-surface' : undefined}
              >
                {renderPreview(selectedItem)}
              </PreviewPaneShell>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TableWithPreviewLayout;
