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

import { ItemStatus, OpenDocument } from './types';

interface DynamicTabsProps {
  documents: OpenDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onShowList: () => void;
}

// Max visible tabs before overflow
const MAX_VISIBLE_TABS = 6;

// Status dot colors
const STATUS_COLORS: Record<ItemStatus, string> = {
  draft: 'bg-slate-400',
  in_review: 'bg-amber-400',
  approved: 'bg-emerald-400',
  completed: 'bg-emerald-400',
};

// Type colors for left border accent
const TYPE_BORDER_COLORS: Record<string, string> = {
  // Assessment frameworks
  DRD: 'border-l-purple-500',
  SIRI: 'border-l-blue-500',
  ADMA: 'border-l-teal-500',
  CMMI: 'border-l-orange-500',
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
  ROB: 'border-l-purple-500',
  LOG: 'border-l-purple-500',
  RPA: 'border-l-purple-500',
  AID: 'border-l-purple-500',
  INT: 'border-l-purple-500',
  DVP: 'border-l-purple-500',
  LEG: 'border-l-purple-500',
  DAT: 'border-l-purple-500',
  P2S: 'border-l-purple-500',
  SPE: 'border-l-purple-500',
  // Discovery Tools - Automation
  PAI: 'border-l-amber-500',
};

// Shared tab styles
const TAB_BASE = `
  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
  border border-l-2 transition-all duration-200 cursor-pointer
`;

const TAB_INACTIVE = `
  ${TAB_BASE}
  bg-navy-800 border-navy-600 text-slate-400
  hover:bg-navy-700 hover:border-slate-500 hover:text-white
`;

const TAB_ACTIVE = `
  ${TAB_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
  shadow-sm shadow-primary-500/10
`;

export const DynamicTabs: React.FC<DynamicTabsProps> = ({
  documents,
  activeDocumentId,
  onSelectDocument,
  onCloseDocument,
  onShowList,
}) => {
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
    <div className="flex items-center gap-2 px-4 py-2 bg-navy-900/50 border-b border-navy-700">
      {/* List button - same style as tabs */}
      <button
        onClick={onShowList}
        className={
          isListActive
            ? TAB_ACTIVE.replace('border-l-2', '')
            : TAB_INACTIVE.replace('border-l-2', '')
        }
      >
        <ListIcon size={14} />
        <span>List</span>
      </button>

      {/* Separator */}
      {documents.length > 0 && <div className="w-px h-6 bg-navy-600" />}

      {/* Visible Document Tabs */}
      {visibleDocs.map((doc) => {
        const isActive = doc.id === activeDocumentId;
        const leftBorderColor = TYPE_BORDER_COLORS[doc.subType] || 'border-l-slate-500';
        const statusColor = STATUS_COLORS[doc.status];

        return (
          <div
            key={doc.id}
            className={`
              group ${isActive ? TAB_ACTIVE : TAB_INACTIVE}
              ${leftBorderColor}
            `}
            onClick={() => onSelectDocument(doc.id)}
          >
            {/* Type Badge */}
            <span
              className={`font-mono text-xs ${isActive ? 'text-primary-300' : 'text-slate-500'}`}
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
              onClick={(e) => {
                e.stopPropagation();
                onCloseDocument(doc.id);
              }}
              className="
                p-0.5 rounded opacity-0 group-hover:opacity-100
                text-slate-400 hover:text-white hover:bg-navy-600
                transition-all
              "
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {/* Overflow Menu */}
      {overflowDocs.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowOverflowMenu(!showOverflowMenu)}
            className={`
              flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium
              border transition-all duration-200
              ${
                activeInOverflow
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-navy-800 border-navy-600 text-slate-400 hover:text-white hover:border-slate-500'
              }
            `}
          >
            <span>+{overflowDocs.length}</span>
            <ChevronDown size={14} className={showOverflowMenu ? 'rotate-180' : ''} />
          </button>

          {/* Dropdown Menu */}
          {showOverflowMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOverflowMenu(false)} />
              <div className="absolute top-full right-0 mt-1 z-50 min-w-[200px] bg-navy-800 border border-navy-600 rounded-lg shadow-xl overflow-hidden">
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
                            ? 'bg-primary-500/15 text-primary-400'
                            : 'text-slate-300 hover:bg-navy-700'
                        }
                      `}
                    >
                      <span className="font-mono text-xs text-slate-500">{doc.subType}</span>
                      <span className="flex-1 truncate">{doc.name}</span>
                      <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseDocument(doc.id);
                        }}
                        className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-navy-600"
                      >
                        <X size={14} />
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
  );
};

export default DynamicTabs;
