/**
 * CardContainer / CardHeader (M13 Depth · Seria K · K2).
 *
 * The canonical, registry-driven section shell for the initiative document.
 * `CardContainer` is the collapsible card (re-exported `CollapsibleSection`,
 * now registry-aware: pass a `sectionType` and the icon/colour/title come from
 * the registry instead of being hard-coded per section).
 *
 * `CardHeader` is the same header row as a standalone, for the few bespoke
 * sections (Tasks, Decisions, …) that manage their own body but want the one
 * unified, registry-driven header look (icon chip + title + actions + badge).
 */
import React from 'react';

import { CollapsibleSection } from '../CollapsibleSection';
import type { SectionTypeInfo } from '../types';
import { SectionIcon } from './sectionIcon';

/** Canonical K2 name for the collapsible, registry-driven section card. */
export const CardContainer = CollapsibleSection;

export interface CardHeaderProps {
  /** Registry-driven identity — supplies icon/colour/title when not overridden. */
  sectionType?: SectionTypeInfo;
  title?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/** Standalone, non-collapsible header matching the CardContainer header. */
export const CardHeader: React.FC<CardHeaderProps> = ({
  sectionType,
  title,
  icon,
  iconBg,
  actions,
  badge,
  className,
}) => {
  const resolvedTitle = title ?? (sectionType ? sectionType.namePl || sectionType.name : '');
  const resolvedIcon =
    icon ??
    (sectionType ? <SectionIcon name={sectionType.icon} color={sectionType.iconColor} /> : null);
  const resolvedIconBg = iconBg ?? sectionType?.iconBg ?? 'bg-slate-500/10 dark:bg-slate-500/20';

  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {resolvedIcon != null && (
          <div className={`p-2 rounded-xl shrink-0 ${resolvedIconBg}`}>{resolvedIcon}</div>
        )}
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
          {resolvedTitle}
        </span>
        {badge}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

export default CardContainer;
