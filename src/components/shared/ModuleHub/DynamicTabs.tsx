/**
 * DynamicTabs
 * Row of open document tabs with close buttons
 *
 * Design:
 * - List button and document tabs use consistent bordered style
 * - Active tab has purple border
 * - Max 6 visible tabs, overflow goes to dropdown
 * - Smooth scrolling for many tabs
 */

import { ChevronDown, List as ListIcon, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_RIGHT_CLASS,
  MENU_3_ROW_CLASS,
} from '@/components/shared/ModuleMenu3';

import { ItemStatus, OpenDocument } from './types';

interface DynamicTabsProps {
  documents: OpenDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onShowList: () => void;
  /** Right-side actions in Menu 3. Used for contextual AI/actions; never add a second row. */
  rightContent?: React.ReactNode;
}

// Max visible tabs before overflow
const MAX_VISIBLE_TABS = 6;

// Status dot colors - uses canonical 11-status initiative lifecycle.
// SCHEDULED = blue (info, jak PROMOTED/EXECUTING/TRACKING) - było crimson
// (primary-400), naruszenie C1 statusChipTone SSOT (TRIADA_KANON.md).
const STATUS_COLORS: Record<ItemStatus, string> = {
  DRAFT: 'bg-slate-400',
  PENDING_REVIEW: 'bg-amber-400',
  REVIEW: 'bg-amber-400',
  PROMOTED: 'bg-blue-400',
  PLANNING: 'bg-indigo-400',
  APPROVED: 'bg-emerald-400',
  SCHEDULED: 'bg-blue-400',
  EXECUTING: 'bg-blue-400',
  BLOCKED: 'bg-danger-400',
  DONE: 'bg-green-400',
  TRACKING: 'bg-blue-400',
  CANCELLED: 'bg-gray-400',
  ARCHIVED: 'bg-slate-500',
};

// Type colors for left border accent.
// DRD + Discovery Tools „Digital" + assessment (poniżej) = indigo - było
// crimson (border-l-primary-500), naruszenie TRIADA_KANON.md część C1
// (primary = crimson, nielegalny nawet jako akcent kategorii). Indigo
// wybrany bo żadna sąsiednia grupa go nie zajmuje (Strategic=emerald,
// Operational=blue, Automation=amber, LEAN=green, upload=slate) -
// zachowuje wizualne rozróżnienie grup, tylko bez marki w chrome.
const TYPE_BORDER_COLORS: Record<string, string> = {
  // Assessment frameworks
  DRD: 'border-l-indigo-500',
  SIRI: 'border-l-blue-500',
  ADMA: 'border-l-blue-500',
  CMMI: 'border-l-amber-500',
  LEAN: 'border-l-green-500',
  // Discovery Tools - Strategic
  SWT: 'border-l-emerald-500',
  PTR: 'border-l-emerald-500',
  ANS: 'border-l-emerald-500',
  VCH: 'border-l-emerald-500',
  BCG: 'border-l-emerald-500',
  AMB: 'border-l-emerald-500',
  FOC: 'border-l-emerald-500',
  RSK: 'border-l-emerald-500',
  CAP: 'border-l-emerald-500',
  NAR: 'border-l-emerald-500',
  // Discovery Tools - Operational
  VSM: 'border-l-blue-500',
  SOP: 'border-l-blue-500',
  A3P: 'border-l-blue-500',
  SMD: 'border-l-blue-500',
  DMS: 'border-l-blue-500',
  AUT: 'border-l-blue-500',
  CON: 'border-l-blue-500',
  DEC: 'border-l-blue-500',
  CTW: 'border-l-blue-500',
  INV: 'border-l-blue-500',
  // Discovery Tools - Digital
  ROB: 'border-l-indigo-500',
  LOG: 'border-l-indigo-500',
  RPA: 'border-l-indigo-500',
  AID: 'border-l-indigo-500',
  INT: 'border-l-indigo-500',
  DVP: 'border-l-indigo-500',
  LEG: 'border-l-indigo-500',
  DAT: 'border-l-indigo-500',
  P2S: 'border-l-indigo-500',
  SPE: 'border-l-indigo-500',
  // Discovery Tools - Automation
  PAI: 'border-l-amber-500',
  // V3-J02 — Presentations Hub (source types)
  tool: 'border-l-emerald-500',
  assessment: 'border-l-indigo-500',
  finance: 'border-l-blue-500',
  upload: 'border-l-slate-500',
};

// Dynamic document tabs are Menu 3 chips with an optional left accent.
const TAB_INACTIVE = MENU_3_CHIP_INACTIVE;
const TAB_ACTIVE = MENU_3_CHIP_ACTIVE;

export const DynamicTabs: React.FC<DynamicTabsProps> = ({
  documents,
  activeDocumentId,
  onSelectDocument,
  onCloseDocument,
  onShowList,
  rightContent,
}) => {
  const { t } = useTranslation();
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // Split documents into visible and overflow
  const { visibleDocs, overflowDocs } = useMemo(() => {
    if (documents.length <= MAX_VISIBLE_TABS) {
      return { visibleDocs: documents, overflowDocs: [] };
    }
    return {
      visibleDocs: documents.slice(0, MAX_VISIBLE_TABS),
      overflowDocs: documents.slice(MAX_VISIBLE_TABS),
    };
  }, [documents]);

  // Check if active document is in overflow
  const activeInOverflow = useMemo(() => {
    return overflowDocs.some((doc) => doc.id === activeDocumentId);
  }, [overflowDocs, activeDocumentId]);

  if (documents.length === 0) {
    return null;
  }

  const isListActive = activeDocumentId === null;

  return (
    <div className={MENU_3_ROW_CLASS}>
      <div className={MENU_3_INNER_CLASS}>
        <div className="flex min-w-0 items-center gap-2">
          {/* List button - same style as tabs */}
          <button
            type="button"
            onClick={onShowList}
            aria-label={t('common.backToList', 'Back to list')}
            className={isListActive ? TAB_ACTIVE : TAB_INACTIVE}
          >
            <ListIcon size={14} aria-hidden="true" />
            <span>{t('common.list', 'List')}</span>
          </button>

          {/* Separator */}
          {documents.length > 0 && (
            <div className="w-px h-6 bg-slate-200/70 dark:bg-white/[0.06]" />
          )}

          {/* Visible Document Tabs */}
          {visibleDocs.map((doc) => {
            const isActive = doc.id === activeDocumentId;
            const leftBorderColor = TYPE_BORDER_COLORS[doc.subType] || 'border-l-slate-500';
            const statusColor = STATUS_COLORS[doc.status];

            return (
              <div
                key={doc.id}
                className={`group ${isActive ? TAB_ACTIVE : TAB_INACTIVE} ${leftBorderColor} border-l-2`}
                onClick={() => onSelectDocument(doc.id)}
              >
                {/* Type Badge */}
                <span
                  className={`font-mono text-xs ${isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}
                >
                  {doc.subType}
                </span>

                {/* Name (truncated) */}
                <span className="max-w-[120px] truncate">{doc.name}</span>

                {/* Status Dot */}
                <span className={`w-2 h-2 rounded-full ${statusColor}`} title={doc.status} />

                {/* Unsaved indicator */}
                {doc.hasUnsavedChanges && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
                    title="Unsaved changes"
                  />
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseDocument(doc.id);
                  }}
                  aria-label={t('common.closeDocumentNamed', 'Close {{name}}', { name: doc.name })}
                  className="
                p-0.5 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus:opacity-100
                text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-600
                transition-all
              "
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            );
          })}

          {/* Overflow Menu */}
          {overflowDocs.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                aria-haspopup="true"
                aria-expanded={showOverflowMenu}
                aria-label={t('common.moreOpenDocuments', 'More open documents ({{count}})', {
                  count: overflowDocs.length,
                })}
                className={activeInOverflow ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
              >
                <span aria-hidden="true">+{overflowDocs.length}</span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={showOverflowMenu ? 'rotate-180' : ''}
                />
              </button>

              {/* Dropdown Menu */}
              {showOverflowMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOverflowMenu(false)} />
                  <div className="absolute top-full right-0 mt-1 z-50 min-w-[200px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 dark:border-white/[0.08] dark:bg-navy-900 dark:shadow-black/30">
                    {overflowDocs.map((doc) => {
                      const isActive = doc.id === activeDocumentId;
                      const statusColor = STATUS_COLORS[doc.status];

                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            onSelectDocument(doc.id);
                            setShowOverflowMenu(false);
                          }}
                          className={`
                        flex items-center gap-2 px-3 py-2 cursor-pointer
                        ${
                          isActive
                            ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700'
                        }
                      `}
                        >
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {doc.subType}
                          </span>
                          <span className="flex-1 truncate">{doc.name}</span>
                          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseDocument(doc.id);
                            }}
                            aria-label={t('common.closeDocumentNamed', 'Close {{name}}', {
                              name: doc.name,
                            })}
                            className="p-0.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-600"
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div id="module-command-row-right-actions" className={MENU_3_RIGHT_CLASS}>
          {rightContent}
        </div>
      </div>
    </div>
  );
};

export default DynamicTabs;
