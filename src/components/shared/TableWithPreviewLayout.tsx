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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';

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
}: TableWithPreviewLayoutProps<T>) {
  const { t } = useTranslation();
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPreviewOpen = controlledPreviewOpen ?? internalPreviewOpen;

  // If selection is controlled externally (row click sets selectedId),
  // keep internal preview open state in sync (KANON: single click opens preview).
  useEffect(() => {
    // When previewOpen is controlled from outside, don't fight it.
    if (controlledPreviewOpen !== undefined) return;
    if (!autoOpenPreview) return;

    if (selectedId) {
      setInternalPreviewOpen(true);
    } else {
      setInternalPreviewOpen(false);
    }
  }, [selectedId, controlledPreviewOpen, autoOpenPreview]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      if (autoOpenPreview) {
        setInternalPreviewOpen(true);
      }
    },
    [onSelect, autoOpenPreview]
  );

  const handleClose = useCallback(() => {
    setInternalPreviewOpen(false);
    onSelect(null);
  }, [onSelect]);

  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!itemIds.length) return;

      const currentIdx = selectedId ? itemIds.indexOf(selectedId) : -1;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const nextIdx = Math.min(currentIdx + 1, itemIds.length - 1);
          handleSelect(itemIds[nextIdx]);
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          handleSelect(itemIds[prevIdx]);
          break;
        }
        case 'Enter': {
          if (selectedId && onOpenFull) {
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
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [itemIds, selectedId, handleSelect, handleClose, onOpenFull]);

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden gap-1.5" tabIndex={0}>
      {/* Table area */}
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>

      {/* Preview pane — 20-33% width, min 340px, clamp() for responsiveness */}
      {isPreviewOpen && selectedItem && (
        <div
          className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3"
          style={{ width: 'clamp(340px, 28%, 480px)' }}
        >
          <PreviewPaneShell
            title={selectedItem.title}
            onClose={handleClose}
            actions={
              <>
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
            }
            footer={renderPreviewFooter?.(selectedItem)}
          >
            {renderPreview(selectedItem)}
          </PreviewPaneShell>
        </div>
      )}
    </div>
  );
}

export default TableWithPreviewLayout;
