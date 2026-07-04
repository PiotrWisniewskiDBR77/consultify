/**
 * DynamicTabBarOverflow
 * Dropdown for tabs that don't fit in the visible bar.
 * V3-A02: Dynamic menu / open documents system
 */

import { ChevronDown, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { OpenDocument } from '../../../store/openDocumentsStore';

function getTypeBadge(type: OpenDocument['type']): string {
  const labels: Record<OpenDocument['type'], string> = {
    initiative: 'Initiative',
    tool_session: 'Tool',
    report: 'Report',
    presentation: 'Deck',
    kpi: 'KPI',
    decision: 'Decision',
    task: 'Task',
  };
  return labels[type] || type;
}

interface DynamicTabBarOverflowProps {
  documents: OpenDocument[];
  activeDocumentId: string | null;
  onSelect: (docId: string) => void;
  onClose: (docId: string) => void;
  onCloseAll: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const DynamicTabBarOverflow: React.FC<DynamicTabBarOverflowProps> = ({
  documents,
  activeDocumentId,
  onSelect,
  onClose,
  onCloseAll,
  isOpen,
  onToggle,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  if (documents.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1.5 rounded-t-lg text-sm font-medium text-slate-600 hover:text-slate-200 hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-xs font-semibold bg-navy-700 text-slate-600 px-1.5 py-0.5 rounded">
          +{documents.length}
        </span>
        <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} aria-hidden="true" />
          <div
            className="absolute top-full right-0 mt-0.5 z-50 min-w-[220px] max-h-[320px] overflow-y-auto bg-navy-800 border border-c-border-subtle rounded-lg shadow-xl"
            role="listbox"
          >
            {documents.map((doc) => {
              const isActive = doc.id === activeDocumentId;
              return (
                <div
                  key={doc.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect(doc.id);
                    onToggle();
                  }}
                  className={`
                    flex items-center gap-2 px-3 py-2 cursor-pointer group
                    ${isActive ? 'bg-navy-700 text-white' : 'text-slate-600 hover:text-slate-200 hover:bg-white/5'}
                  `}
                >
                  {doc.dirty && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                      title={t('dynamicTabBar.unsaved', 'Unsaved changes')}
                    />
                  )}
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-navy-700/80 text-slate-600 shrink-0">
                    {getTypeBadge(doc.type)}
                  </span>
                  <span className="flex-1 truncate min-w-0">{doc.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(doc.id);
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-600 hover:text-white hover:bg-white/10 transition-opacity"
                    aria-label={t('dynamicTabBar.closeTab', 'Close tab')}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            <div className="border-t border-c-border-subtle">
              <button
                type="button"
                onClick={() => {
                  onCloseAll();
                  onToggle();
                }}
                className="w-full px-3 py-2 text-sm text-slate-600 hover:text-slate-200 hover:bg-white/5 text-left"
              >
                {t('dynamicTabBar.closeAll', 'Close all')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DynamicTabBarOverflow;
