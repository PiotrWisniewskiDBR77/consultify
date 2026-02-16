/**
 * NavItem Component - Apple HIG Design System
 *
 * A single navigation item in the sidebar with hover states and icons.
 */

import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import React from 'react';

import { AppView, UserRole } from '../../../types';
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
  const badgeLabel = item.badge === 'soon' ? 'In development' : item.badge;

  // Check if locked
  const isLocked =
    item.requiresView &&
    !completedViews.includes(item.requiresView) &&
    !(currentUserRole === UserRole.ADMIN || currentUserRole === 'SUPERADMIN');

  // Check if any child is active
  const isChildActive = (i: MenuItem): boolean => {
    if (i.viewId === currentView) return true;
    if (i.subItems) return i.subItems.some((sub) => isChildActive(sub));
    return false;
  };
  const isParentActive = hasSubItems && isChildActive(item);

  // Tooltip
  const getTooltip = () => {
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
        data-chat-toggle={item.id === 'AI_CHAT' ? 'true' : undefined}
        onClick={() => onClick(item)}
        disabled={isLocked}
        whileTap={!isLocked ? { scale: 0.98 } : undefined}
        className={`
          w-full flex items-center text-sm transition-all duration-150 ease-out relative group
          ${isTouchDevice ? 'py-3 min-h-[44px]' : 'py-2.5'}
          ${showFull ? 'px-3' : 'px-0 justify-center'}
          rounded-xl
          ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${
            isHighlighted
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : isParentActive
                ? 'text-navy-900 dark:text-white font-medium bg-slate-50 dark:bg-white/5'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
          }
        `}
        title={getTooltip()}
      >
        {/* Left side: Icon and Label */}
        <div
          className={`flex items-center gap-3 min-w-0 ${!showFull ? 'justify-center w-full' : 'flex-1'}`}
        >
          {item.icon && (
            <span
              className={`
                transition-colors
                ${
                  isHighlighted || isParentActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }
              `}
            >
              {React.cloneElement(item.icon as React.ReactElement<{ size: number }>, { size: 20 })}
            </span>
          )}

          {showFull && (
            <span className="truncate tracking-wide flex-1 text-left">{item.label}</span>
          )}
        </div>

        {/* Right side: Status icons */}
        {showRightSide && (
          <div className="flex items-center gap-2 ml-auto">
            {/* Badge */}
            {item.badge && (
              <span
                className={`
                  px-2 py-0.5 text-[10px] font-semibold rounded-full tracking-wide shrink-0 border
                  ${item.badge === 'beta' ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300 border-amber-500/25 dark:border-amber-400/20' : ''}
                  ${item.badge === 'new' ? 'bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-300 border-green-500/25 dark:border-green-400/20' : ''}
                  ${item.badge === 'soon' ? 'bg-amber-400/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300 border-amber-400/25 dark:border-amber-400/20' : ''}
                `}
              >
                {badgeLabel}
              </span>
            )}
            {isCompleted && !isActive && <CheckCircle2 size={14} className="text-success-500/80" />}
            {isLocked && <Lock size={12} className="text-slate-400 dark:text-slate-500" />}
            {hasSubItems && (
              <motion.span
                className="text-slate-400 dark:text-slate-600"
                animate={{ x: isFloatingActive ? 2 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <ChevronRight size={14} />
              </motion.span>
            )}
          </div>
        )}

        {/* Active indicator */}
        {isHighlighted && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary-500 rounded-full"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </motion.button>
    </div>
  );
};

export default NavItem;
