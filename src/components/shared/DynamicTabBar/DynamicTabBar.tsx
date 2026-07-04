/**
 * DynamicTabBar (V3-A02)
 * Tab bar below module hub topbar: Home tab + document tabs + overflow.
 * DBR77: h-10, bg-navy-900, border-b border-c-border-subtle
 */

import { Home, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import type { OpenDocument } from '../../../store/openDocumentsStore';
import { useConfirmDialog } from '../../MyWork/shared/ConfirmDialog';
import { DynamicTabBarOverflow } from './DynamicTabBarOverflow';

const MAX_TITLE_LENGTH = 20;

function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

interface DynamicTabBarProps {
  moduleKey: string;
  moduleName: string;
  documents: OpenDocument[];
  visibleTabs: OpenDocument[];
  overflowTabs: OpenDocument[];
  activeDocumentId: string | null;
  maxVisibleTabs?: number;
  onSelectDocument: (docId: string) => void;
  onCloseDocument: (docId: string) => void;
  onShowCollection: () => void;
  onCloseAll: () => void;
}

export const DynamicTabBar: React.FC<DynamicTabBarProps> = ({
  moduleKey,
  moduleName,
  documents,
  visibleTabs,
  overflowTabs,
  activeDocumentId,
  maxVisibleTabs = 5,
  onSelectDocument,
  onCloseDocument,
  onShowCollection,
  onCloseAll,
}) => {
  const { t } = useTranslation();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { dialog: confirmDialog, confirm: showConfirm } = useConfirmDialog();

  const handleCloseWithConfirm = useCallback(
    async (doc: OpenDocument) => {
      if (doc.dirty) {
        const ok = await showConfirm({
          title: t('dynamicTabBar.unsavedTitle', 'Unsaved changes'),
          description: t(
            'dynamicTabBar.unsavedDesc',
            'This document has unsaved changes. Close anyway?'
          ),
          confirmLabel: t('dynamicTabBar.closeAnyway', 'Close'),
          cancelLabel: t('common.cancel', 'Cancel'),
          variant: 'warning',
        });
        if (!ok) return;
      }
      onCloseDocument(doc.id);
      trackFunnelEvent('dynamic_tab_closed', { type: doc.type, moduleKey });
    },
    [onCloseDocument, showConfirm, t, moduleKey]
  );

  const handleCloseAllWithConfirm = useCallback(async () => {
    const dirtyCount = documents.filter((d) => d.dirty).length;
    if (dirtyCount > 0) {
      const ok = await showConfirm({
        title: t('dynamicTabBar.closeAllTitle', 'Close all tabs?'),
        description: t(
          'dynamicTabBar.closeAllDesc',
          '{{count}} tab(s) have unsaved changes. Close anyway?',
          { count: dirtyCount }
        ),
        confirmLabel: t('dynamicTabBar.closeAnyway', 'Close'),
        cancelLabel: t('common.cancel', 'Cancel'),
        variant: 'warning',
      });
      if (!ok) return;
    }
    onCloseAll();
  }, [documents, onCloseAll, showConfirm, t]);

  // Ctrl+W to close active tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        if (activeDocumentId) {
          const doc = documents.find((d) => d.id === activeDocumentId);
          if (doc) {
            e.preventDefault();
            handleCloseWithConfirm(doc);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeDocumentId, documents, handleCloseWithConfirm]);

  const isCollectionActive = activeDocumentId === null;

  return (
    <>
      {confirmDialog}
      <div className="h-10 flex items-center gap-1 px-3 bg-navy-900 border-b border-c-border-subtle shrink-0">
        {/* Home tab */}
        <button
          type="button"
          onClick={onShowCollection}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors
            ${
              isCollectionActive
                ? 'bg-navy-800 text-white border-b-2 border-[var(--c-info)] -mb-px'
                : 'text-slate-600 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          <Home size={14} />
          <span>{moduleName}</span>
        </button>

        {documents.length > 0 && <div className="w-px h-5 bg-white/5 shrink-0" aria-hidden />}

        {/* Visible document tabs */}
        {visibleTabs.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          return (
            <div
              key={doc.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelectDocument(doc.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  handleCloseWithConfirm(doc);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDocument(doc.id);
                }
              }}
              className={`
                group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm font-medium cursor-pointer transition-colors
                ${
                  isActive
                    ? 'bg-navy-800 text-white border-b-2 border-[var(--c-info)] -mb-px'
                    : 'text-slate-600 hover:text-slate-200 hover:bg-white/5'
                }
              `}
            >
              {doc.dirty && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                  title={t('dynamicTabBar.unsaved', 'Unsaved changes')}
                />
              )}
              <span className="max-w-[140px] truncate">{truncateTitle(doc.title)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseWithConfirm(doc);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-600 hover:text-white hover:bg-white/10 transition-opacity"
                aria-label={t('dynamicTabBar.closeTab', 'Close tab')}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}

        {/* Overflow */}
        {overflowTabs.length > 0 && (
          <DynamicTabBarOverflow
            documents={overflowTabs}
            activeDocumentId={activeDocumentId}
            onSelect={(id) => {
              onSelectDocument(id);
              setOverflowOpen(false);
            }}
            onClose={(id) => {
              const doc = documents.find((d) => d.id === id);
              if (doc) handleCloseWithConfirm(doc);
            }}
            onCloseAll={handleCloseAllWithConfirm}
            isOpen={overflowOpen}
            onToggle={() => {
              setOverflowOpen((v) => {
                if (!v) trackFunnelEvent('dynamic_tab_overflow_opened', { moduleKey });
                return !v;
              });
            }}
          />
        )}
      </div>
    </>
  );
};

export default DynamicTabBar;
