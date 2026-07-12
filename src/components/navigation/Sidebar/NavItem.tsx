/**
 * NavItem Component — Tech Sexy Design System (T102)
 *
 * Sidebar nav item with monochromatic chrome, invisible borders,
 * bg-only hover, and outline mono-weight icons.
 */

import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import React from 'react';

import { AppView, UserRole } from '../../../types';
import { isAdminOwnerOrSuperAdminRole } from '../../../utils/roleGuards';
import { MenuItem } from './types';

interface NavItemProps {
  item: MenuItem;
  currentView: AppView;
  completedViews: AppView[];
  showFull: boolean;
  isTouchDevice: boolean;
  isChatSlidingPanelOpen: boolean;
  isFloatingActive: boolean;
  currentUserRole?: UserRole | 'SUPERADMIN';
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => void;
  onMouseLeave: () => void;
  onClick: (item: MenuItem) => void;
  getViewName: (view: AppView) => string;
  t: (key: string, fallback?: string) => string;
}

export const NavItem: React.FC<NavItemProps> = ({
  item,
  currentView,
  completedViews,
  showFull,
  isTouchDevice,
  isChatSlidingPanelOpen,
  isFloatingActive,
  currentUserRole,
  onMouseEnter,
  onMouseLeave,
  onClick,
  getViewName,
  t,
}) => {
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const isActive = item.viewId === currentView;
  const isCompleted = item.viewId && completedViews.includes(item.viewId);
  const badgeLabel = item.badge === 'soon' ? 'Wkrótce' : item.badge;

  const isLockedByFlow =
    item.requiresView &&
    !completedViews.includes(item.requiresView) &&
    !isAdminOwnerOrSuperAdminRole(currentUserRole);
  const isLocked = Boolean(item.isLocked || isLockedByFlow);

  const isChildActive = (i: MenuItem): boolean => {
    if (i.viewId === currentView) return true;
    if (i.subItems) return i.subItems.some((sub) => isChildActive(sub));
    return false;
  };
  const isParentActive = hasSubItems && isChildActive(item);

  const getTooltip = () => {
    if (item.isLocked && item.lockedMessage) {
      return item.lockedMessage;
    }
    if (isLocked && item.requiresView) {
      return `${t('common.locked')}: ${t('common.complete')} ${getViewName(item.requiresView)} ${t('common.first')}`;
    }
    if (!showFull) {
      return item.label;
    }
    return undefined;
  };

  const isHighlighted = isActive || (item.id === 'AI_CHAT' && isChatSlidingPanelOpen);
  const showRightSide =
    showFull &&
    (Boolean(item.badge) ||
      (Boolean(isCompleted) && !isActive) ||
      Boolean(isLocked) ||
      hasSubItems);

  return (
    <div
      className="relative w-full px-1"
      onMouseEnter={(e) => onMouseEnter(e, item)}
      onMouseLeave={onMouseLeave}
    >
      <motion.button
        type="button"
        data-chat-toggle={item.id === 'AI_CHAT' ? 'true' : undefined}
        aria-disabled={isLocked ? 'true' : undefined}
        onClick={() => {
          // Flow-locked items stay silent; items carrying a lockedCode (e.g. beta)
          // surface their access plate via the parent handler.
          if (isLocked && !item.lockedCode) return;
          onClick(item);
        }}
        whileTap={{ scale: 0.98 }}
        className={[
          'w-full flex items-center text-sm transition-all duration-150 ease-out relative group rounded-lg',
          isTouchDevice ? 'py-2.5 min-h-[44px]' : 'py-[7px]',
          showFull ? 'px-2.5 gap-2.5' : 'px-0 justify-center',
          isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          isHighlighted
            ? 'bg-slate-200/60 dark:bg-white/10 text-c-text font-medium'
            : isParentActive
              ? 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/[0.04]'
              : 'text-c-text-secondary hover:bg-slate-100 dark:hover:bg-white/5 hover:text-c-text',
        ].join(' ')}
        title={getTooltip()}
        aria-current={isHighlighted ? 'page' : undefined}
      >
        {/* Icon */}
        {item.icon && (
          <span
            className={[
              'shrink-0 transition-colors',
              isHighlighted
                ? 'text-c-text'
                : isParentActive
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300',
            ].join(' ')}
          >
            {React.cloneElement(
              item.icon as React.ReactElement<{ size: number; strokeWidth: number }>,
              {
                size: 18,
                strokeWidth: 1.75,
              }
            )}
          </span>
        )}

        {/* Label */}
        {showFull && (
          <span className="truncate flex-1 text-left text-[13px] leading-5">{item.label}</span>
        )}

        {/* Right side */}
        {showRightSide && (
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {item.badge && (
              <span
                className={[
                  'px-1.5 py-px text-[10px] font-medium rounded-full tracking-wide',
                  item.badge === 'beta'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300'
                    : item.badge === 'new'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-400', // 'soon' = neutral gray, not accent
                ].join(' ')}
              >
                {badgeLabel}
              </span>
            )}
            {isCompleted && !isActive && (
              <CheckCircle2 size={13} strokeWidth={1.75} className="text-emerald-500/70" />
            )}
            {isLocked && <Lock size={12} strokeWidth={1.75} className="text-slate-600" />}
            {hasSubItems && (
              <motion.span
                className="text-slate-600"
                animate={{ x: isFloatingActive ? 2 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <ChevronRight size={13} strokeWidth={1.75} />
              </motion.span>
            )}
          </div>
        )}

        {/* Active accent bar */}
        {isHighlighted && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[var(--c-info)] rounded-r-full"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </motion.button>
    </div>
  );
};

export default NavItem;
