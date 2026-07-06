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
  Lock,
  Plus,
  Share2,
  Table2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TablePlatformView } from '@/types/tablePlatform';

import { ShareViewDialog } from './ShareViewDialog';

// ── Types ────────────────────────────────────────────────────────────────────

type ViewType = TablePlatformView['viewType'];

export interface ViewSwitcherProps {
  views: TablePlatformView[];
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  onCreateView: (name: string, type: ViewType, isPersonal?: boolean) => void;
}

// ── View type icons and labels ───────────────────────────────────────────────

const VIEW_TYPE_META: Record<
  ViewType,
  { icon: React.FC<{ size?: number; className?: string }>; labelEn: string; labelPl: string }
> = {
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
  const [newPersonal, setNewPersonal] = useState(false);
  const [sharingViewId, setSharingViewId] = useState<string | null>(null);
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
  const ActiveIcon = activeView ? (VIEW_TYPE_META[activeView.viewType]?.icon ?? Table2) : Table2;

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateView(trimmed, newType, newPersonal);
    setNewName('');
    setNewType('grid');
    setNewPersonal(false);
    setCreating(false);
    setOpen(false);
  }, [newName, newType, newPersonal, onCreateView]);

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
    [handleCreate]
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors"
      >
        <ActiveIcon size={12} />
        <span className="truncate max-w-[100px]">
          {activeView?.name ?? (isPl ? 'Widoki' : 'Views')}
        </span>
        <ChevronDown size={10} className="text-c-text-muted" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-c-border-subtle">
            <span className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider">
              {isPl ? 'Zapisane widoki' : 'Saved views'}
            </span>
          </div>

          {/* View list */}
          <div className="py-1 max-h-[240px] overflow-auto">
            {views.length === 0 && (
              <p className="text-[11px] text-c-text-muted text-center py-3">
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
                  className={`group/view w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-c-surface-raised text-c-text'
                      : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-c-text-secondary' : 'text-c-text-muted'} />
                  <span className="flex-1 truncate">{view.name}</span>
                  {view.isPersonal && <Lock size={10} className="text-c-text-muted flex-shrink-0" />}
                  {view.isShared && <Share2 size={10} className="text-c-success flex-shrink-0" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharingViewId(view.id);
                    }}
                    className="p-0.5 rounded hover:bg-c-surface text-c-text-muted hover:text-c-text-secondary flex-shrink-0 opacity-0 group-hover/view:opacity-100 transition-opacity"
                    title={isPl ? 'Udostępnij' : 'Share'}
                  >
                    <Share2 size={10} />
                  </button>
                  <span className="text-[9px] text-c-text-muted">
                    {isPl ? meta.labelPl : meta.labelEn}
                  </span>
                  {isActive && <Check size={12} className="text-c-text-secondary flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Create section */}
          <div className="border-t border-c-border-subtle px-3 py-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full inline-flex items-center gap-1.5 text-[11px] font-semibold text-c-accent hover:bg-c-accent-soft px-1 py-1.5 rounded-lg transition-colors"
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
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-c-focus"
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
                            ? 'bg-c-accent-soft text-c-accent border border-c-accent'
                            : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                        }`}
                      >
                        <Icon size={10} />
                        {isPl ? meta.labelPl : meta.labelEn}
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPersonal}
                    onChange={(e) => setNewPersonal(e.target.checked)}
                    className="rounded border-c-border-subtle text-c-accent focus:ring-c-focus h-3.5 w-3.5"
                  />
                  <Lock size={10} className="text-c-text-muted" />
                  <span className="text-[10px] text-c-text-muted">
                    {isPl ? 'Widok prywatny' : 'Personal view'}
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-c-accent text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPl ? 'Utwórz' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="p-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {sharingViewId &&
        (() => {
          const view = views.find((v) => v.id === sharingViewId);
          if (!view) return null;
          return (
            <ShareViewDialog
              viewId={view.id}
              viewName={view.name}
              isShared={view.isShared}
              shareToken={view.shareToken}
              onClose={() => setSharingViewId(null)}
              onUpdated={() => setSharingViewId(null)}
            />
          );
        })()}
    </div>
  );
};

export default ViewSwitcher;
