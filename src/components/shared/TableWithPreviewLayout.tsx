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

import { ExternalLink } from 'lucide-react';
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
  /** Preview pane kicker text */
  kicker?: string;
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
  kicker,
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
    <div ref={containerRef} className="flex h-full overflow-hidden" tabIndex={0}>
      {/* Table area */}
      <div
        className={`flex-1 min-w-0 overflow-auto transition-all duration-200 ${
          isPreviewOpen && selectedItem ? '' : ''
        }`}
      >
        {children}
      </div>

      {/* Preview pane — 20-33% width, min 340px, clamp() for responsiveness */}
      {isPreviewOpen && selectedItem && (
        <div
          className="shrink-0 border-l border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950"
          style={{ width: 'clamp(340px, 28%, 480px)' }}
        >
          <PreviewPaneShell
            kicker={kicker || t('common.preview', 'Preview')}
            title={selectedItem.title}
            onClose={handleClose}
            actions={
              <>
                {renderPreviewActions?.(selectedItem)}
                {onOpenFull && (
                  <button
                    onClick={() => onOpenFull(selectedItem.id)}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60 transition-colors"
                    title={t('common.openFull', 'Open full')}
                  >
                    <ExternalLink size={14} />
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
