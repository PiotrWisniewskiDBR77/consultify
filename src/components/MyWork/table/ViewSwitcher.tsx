/**
 * ViewSwitcher — Dropdown for saved views with create-new-view inline form.
 *
 * Shows saved views grouped by type with icons, highlights active view,
 * and allows creating new views via an inline form.
 */
import {
  Calendar,
  Check,
  ChevronDown,
  Grid3X3,
  KanbanSquare,
  LayoutGrid,
  Plus,
  Table2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TablePlatformView } from '@/types/tablePlatform';

// ── Types ────────────────────────────────────────────────────────────────────

type ViewType = TablePlatformView['viewType'];

export interface ViewSwitcherProps {
  views: TablePlatformView[];
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  onCreateView: (name: string, type: ViewType) => void;
}

// ── View type icons and labels ───────────────────────────────────────────────

const VIEW_TYPE_META: Record<ViewType, { icon: React.FC<{ size?: number; className?: string }>; labelEn: string; labelPl: string }> = {
  grid: { icon: Table2, labelEn: 'Grid', labelPl: 'Tabela' },
  kanban: { icon: KanbanSquare, labelEn: 'Kanban', labelPl: 'Kanban' },
  calendar: { icon: Calendar, labelEn: 'Calendar', labelPl: 'Kalendarz' },
  timeline: { icon: LayoutGrid, labelEn: 'Timeline', labelPl: 'Oś czasu' },
  gallery: { icon: Grid3X3, labelEn: 'Gallery', labelPl: 'Galeria' },
  form: { icon: Table2, labelEn: 'Form', labelPl: 'Formularz' },
};

const CREATE_VIEW_TYPES: ViewType[] = ['grid', 'kanban', 'calendar'];

// ── Component ────────────────────────────────────────────────────────────────

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  activeViewId,
  onViewChange,
  onCreateView,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ViewType>('grid');
  const ref = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (creating) nameRef.current?.focus();
  }, [creating]);

  const activeView = views.find((v) => v.id === activeViewId);
  const ActiveIcon = activeView
    ? VIEW_TYPE_META[activeView.viewType]?.icon ?? Table2
    : Table2;

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateView(trimmed, newType);
    setNewName('');
    setNewType('grid');
    setCreating(false);
    setOpen(false);
  }, [newName, newType, onCreateView]);

  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCreating(false);
      }
    },
    [handleCreate],
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
      >
        <ActiveIcon size={12} />
        <span className="truncate max-w-[100px]">
          {activeView?.name ?? (isPl ? 'Widoki' : 'Views')}
        </span>
        <ChevronDown size={10} className="text-slate-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isPl ? 'Zapisane widoki' : 'Saved views'}
            </span>
          </div>

          {/* View list */}
          <div className="py-1 max-h-[240px] overflow-auto">
            {views.length === 0 && (
              <p className="text-[11px] text-slate-400 text-center py-3">
                {isPl ? 'Brak widoków' : 'No views'}
              </p>
            )}
            {views.map((view) => {
              const meta = VIEW_TYPE_META[view.viewType] ?? VIEW_TYPE_META.grid;
              const Icon = meta.icon;
              const isActive = view.id === activeViewId;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    onViewChange(view.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-violet-500' : 'text-slate-400'} />
                  <span className="flex-1 truncate">{view.name}</span>
                  <span className="text-[9px] text-slate-400">
                    {isPl ? meta.labelPl : meta.labelEn}
                  </span>
                  {isActive && <Check size={12} className="text-violet-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Create section */}
          <div className="border-t border-slate-200/60 dark:border-navy-700/60 px-3 py-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-1 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={12} />
                {isPl ? 'Utwórz widok' : 'Create view'}
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  ref={nameRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder={isPl ? 'Nazwa widoku…' : 'View name…'}
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2 py-1.5 text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <div className="flex items-center gap-1">
                  {CREATE_VIEW_TYPES.map((vt) => {
                    const meta = VIEW_TYPE_META[vt];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => setNewType(vt)}
                        className={`flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                          newType === vt
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-300 dark:border-violet-500/40'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 border border-transparent'
                        }`}
                      >
                        <Icon size={10} />
                        {isPl ? meta.labelPl : meta.labelEn}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPl ? 'Utwórz' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSwitcher;
