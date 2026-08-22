/**
 * NModeCardManager — card-management UI for the N-pattern (wzorzec N §3.5)
 *
 * Two dropdown affordances that sit in the artifact toolbar (Menu 3), both
 * driven by the `useCardLayout` result:
 *
 *   • <AddCardMenu>        — "+ Nowa karta ▾": catalog of cards NOT yet on the
 *                            artifact. Click → `addCard(id)`.
 *   • <SectionsManagerMenu>— "Sekcje ▾": show/hide checkboxes + reorder. Uses
 *                            up/down arrows (no dnd dependency required here);
 *                            the left-nav keeps its @dnd-kit drag separately.
 *                            Includes set switcher + "Restore defaults".
 *
 * CRIMSON-SAFE: zero `primary-*`; accent = teal, focus = `c-focus`, tokens c-*.
 * Theme-aware via c-* CSS vars (no `dark:` needed on c-* classes).
 *
 * @see useCardLayout.ts
 * @see cardSets.ts
 */

// cardSets stores icons as string ids (to stay React-free). We resolve them to
// lucide components here; unknown ids fall back to Layers.
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CheckSquare,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Gauge,
  GitCompare,
  GraduationCap,
  Heart,
  History,
  Layers,
  Link2,
  Map as MapIcon,
  MessageSquare,
  Package,
  Paperclip,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Scale,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CardCatalogEntry } from './cardSets';
import type { UseCardLayoutResult } from './useCardLayout';

type IconCmp = React.FC<{ size?: number; className?: string }>;

const ICONS: Record<string, IconCmp> = {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CheckSquare,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Gauge,
  GitCompare,
  GraduationCap,
  Heart,
  History,
  Layers,
  Link2,
  MapIcon,
  MessageSquare,
  Package,
  Paperclip,
  Radio,
  Rocket,
  Scale,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Users,
};

const resolveIcon = (id: string): IconCmp => ICONS[id] ?? Layers;

// ── Shared dropdown scaffolding ─────────────────────────────────────────────────

const TOOLBAR_BTN =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-c-text-secondary border border-c-border hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

// ── + Nowa karta ▾ ───────────────────────────────────────────────────────────────

export interface AddCardMenuProps {
  layout: UseCardLayoutResult;
  isPolish?: boolean;
  className?: string;
}

/** "+ Nowa karta ▾" — catalog of cards not yet on the artifact. */
export const AddCardMenu: React.FC<AddCardMenuProps> = ({
  layout,
  isPolish: isPolishProp,
  className,
}) => {
  const { t: tHook, i18n } = useTranslation();
  const t = typeof isPolishProp === 'boolean' ? i18n.getFixedT(isPolishProp ? 'pl' : 'en') : tHook;
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const { availableToAdd, addCard } = layout;

  // Group the available catalog entries by their `group` for a scannable menu.
  const groups: Array<{ group: string; items: CardCatalogEntry[] }> = [];
  for (const entry of availableToAdd) {
    const g = entry.group ?? '';
    let bucket = groups.find((b) => b.group === g);
    if (!bucket) {
      bucket = { group: g, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(entry);
  }

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={TOOLBAR_BTN}
      >
        <Plus size={14} />
        {t('sharedComponents.nModeCardManager.newCardLabel')}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-c-border bg-c-surface-raised shadow-lg py-1"
        >
          {availableToAdd.length === 0 ? (
            <div className="px-3 py-3 text-xs text-c-text-muted">
              {t('sharedComponents.nModeCardManager.allCardsAdded')}
            </div>
          ) : (
            groups.map((bucket) => (
              <div key={bucket.group || '__ungrouped'} className="px-1 py-1">
                {bucket.group && (
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                    {bucket.group}
                  </div>
                )}
                {bucket.items.map((entry) => {
                  const Icon = resolveIcon(entry.icon);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        addCard(entry.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs rounded-lg text-c-text-secondary hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:bg-c-surface"
                    >
                      <Icon size={13} className="shrink-0 text-c-text-muted" />
                      <span className="flex-1 truncate">
                        {isPolish ? entry.label.pl : entry.label.en}
                      </span>
                      <Plus size={12} className="shrink-0 text-teal-500 dark:text-teal-400" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── Sekcje ▾ (show/hide + reorder + sets) ────────────────────────────────────────

export interface SectionsManagerMenuProps {
  layout: UseCardLayoutResult;
  isPolish?: boolean;
  className?: string;
  buttonClassName?: string;
}

/**
 * "Sekcje ▾" — manage visibility + order of cards already on the artifact.
 * Reorder uses ↑/↓ arrows per row (no dnd dependency); the left-nav keeps its
 * own @dnd-kit drag. Includes the default-set switcher + Restore defaults.
 */
export const SectionsManagerMenu: React.FC<SectionsManagerMenuProps> = ({
  layout,
  isPolish: isPolishProp,
  className,
  buttonClassName,
}) => {
  const { t: tHook, i18n } = useTranslation();
  const t = typeof isPolishProp === 'boolean' ? i18n.getFixedT(isPolishProp ? 'pl' : 'en') : tHook;
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const {
    layout: items,
    catalog,
    spec,
    hideCard,
    showCard,
    removeCard,
    reorderCards,
    applyDefaultSet,
    resetToDefault,
  } = layout;

  const catalogById = new Map(catalog.map((c) => [c.id, c]));

  return (
    <div ref={ref} className={`relative shrink-0 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('sharedComponents.nModeCardManager.sectionsLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${TOOLBAR_BTN} ${buttonClassName ?? ''}`}
      >
        <Layers size={14} />
        <span className="hidden lg:inline">
          {t('sharedComponents.nModeCardManager.sectionsLabel')}
        </span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-c-border bg-c-surface-raised shadow-lg py-1"
        >
          {/* Default-set switcher */}
          {spec.sets.length > 1 && (
            <div className="px-2 py-2 border-b border-c-border-subtle">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {t('sharedComponents.nModeCardManager.defaultSetLabel')}
              </div>
              <div className="flex flex-wrap gap-1">
                {spec.sets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => applyDefaultSet(set.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-c-border text-c-text-secondary hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <Sparkles size={11} className="text-teal-500 dark:text-teal-400" />
                    {isPolish ? set.label.pl : set.label.en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Card rows: visibility toggle + reorder arrows + remove */}
          <div className="px-1 py-1">
            {items.map((item, index) => {
              const meta = catalogById.get(item.id);
              const Icon = resolveIcon(meta?.icon ?? 'Layers');
              const label = meta ? (isPolish ? meta.label.pl : meta.label.en) : item.id;
              const isCore = !!meta?.core;
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-c-surface transition-colors"
                >
                  {/* Visibility toggle */}
                  <button
                    type="button"
                    onClick={() => (item.visible ? hideCard(item.id) : showCard(item.id))}
                    title={
                      item.visible
                        ? t('sharedComponents.nModeCardManager.hideSectionTooltip')
                        : t('sharedComponents.nModeCardManager.showSectionTooltip')
                    }
                    className="shrink-0 text-c-text-muted hover:text-c-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
                  >
                    {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <Icon size={13} className="shrink-0 text-c-text-muted" />
                  <span
                    className={`flex-1 truncate text-xs ${
                      item.visible
                        ? 'text-c-text-secondary'
                        : 'text-c-text-muted line-through opacity-70'
                    }`}
                  >
                    {label}
                  </span>

                  {/* Reorder ↑ / ↓ */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => reorderCards(index, index - 1)}
                    title={t('sharedComponents.nModeCardManager.moveUpTooltip')}
                    className="shrink-0 p-0.5 rounded text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => reorderCards(index, index + 1)}
                    title={t('sharedComponents.nModeCardManager.moveDownTooltip')}
                    className="shrink-0 p-0.5 rounded text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <ArrowDown size={13} />
                  </button>

                  {/* Remove (non-core only) */}
                  {!isCore && (
                    <button
                      type="button"
                      onClick={() => removeCard(item.id)}
                      title={t('sharedComponents.nModeCardManager.removeCardTooltip')}
                      className="shrink-0 p-0.5 rounded text-c-text-muted hover:text-c-danger hover:bg-c-danger/10 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Restore defaults */}
          <div className="border-t border-c-border-subtle">
            <button
              type="button"
              onClick={() => {
                resetToDefault();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-c-text-secondary hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:bg-c-surface"
            >
              <RefreshCw size={14} />
              {t('sharedComponents.nModeCardManager.restoreDefaultsLabel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Combined convenience ─────────────────────────────────────────────────────────

export interface NModeCardManagerProps {
  layout: UseCardLayoutResult;
  isPolish?: boolean;
  /** Hide the "+ Nowa karta" affordance (e.g. read-only mode). */
  hideAdd?: boolean;
}

/** Renders both affordances in canonical order: [Sekcje ▾] [+ Nowa karta ▾]. */
export const NModeCardManager: React.FC<NModeCardManagerProps> = ({
  layout,
  isPolish,
  hideAdd,
}) => (
  <div className="flex items-center gap-1">
    <SectionsManagerMenu layout={layout} isPolish={isPolish} />
    {!hideAdd && <AddCardMenu layout={layout} isPolish={isPolish} />}
  </div>
);

export default NModeCardManager;
