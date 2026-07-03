/**
 * FloatingSubmenu Component - Apple HIG Design System
 *
 * A floating submenu that appears next to sidebar items.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FloatingMenuPosition, MenuItem, ThemeMode } from './types';

interface FloatingSubmenuProps {
  parentRect: DOMRect;
  items: MenuItem[];
  title?: string;
  onClose: () => void;
  onItemClick: (item: MenuItem) => void;
  currentView: import('../../../types').AppView;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  theme: ThemeMode;
}

const menuVariants = {
  hidden: { opacity: 0, x: -8, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 30 },
  },
  exit: {
    opacity: 0,
    x: -8,
    scale: 0.98,
    transition: { duration: 0.15 },
  },
};

export const FloatingSubmenu: React.FC<FloatingSubmenuProps> = ({
  parentRect,
  items,
  title,
  onItemClick,
  currentView,
  onMouseEnter,
  onMouseLeave,
  theme,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<FloatingMenuPosition>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  useLayoutEffect(() => {
    if (!menuRef.current) return;

    let top = parentRect.top;
    const left = parentRect.right + 8;

    const menuHeight = menuRef.current.offsetHeight;
    const windowHeight = window.innerHeight;

    if (top + menuHeight > windowHeight - 20) {
      top = windowHeight - menuHeight - 20;
    }

    if (top < 10) top = 10;

    setPosition({ top, left });
    setIsPositioned(true);
  }, [parentRect]);

  const isDark = theme === 'dark';
  const hasItems = items && items.length > 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        variants={menuVariants as any}
        initial="hidden"
        animate={isPositioned ? 'visible' : 'hidden'}
        exit="exit"
        className={`
          fixed z-context-menu w-56 py-1.5
          rounded-xl
          ${isDark ? 'bg-navy-900 border-white/[0.08]' : 'bg-white border-slate-200/60'}
          border
          shadow-xl
          overflow-hidden
        `}
        style={{ top: position.top, left: position.left }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Header */}
        {title && (
          <div
            className={`
              px-3 py-2 text-[11px] font-medium uppercase tracking-wider
              ${hasItems ? 'border-b mb-0.5' : ''} 
              ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-200 text-slate-500'}
            `}
          >
            {title}
          </div>
        )}

        {/* Menu Items */}
        {items.map((item) => {
          const isActive = item.viewId === currentView;
          const isLocked = Boolean(item.isLocked);

          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item)}
              whileTap={{ scale: 0.98 }}
              title={item.lockedMessage}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2
                text-[13px] font-medium text-left
                transition-colors duration-100
                ${
                  isLocked
                    ? isDark
                      ? 'text-slate-600 hover:bg-white/[0.04]'
                      : 'text-slate-500 hover:bg-slate-50'
                    : isActive
                      ? isDark
                        ? 'bg-white/10 text-slate-100 shadow-[inset_2px_0_0_0_#A82D49]'
                        : 'bg-slate-200/60 text-slate-900 shadow-[inset_2px_0_0_0_#A82D49]'
                      : isDark
                        ? 'text-slate-600 hover:bg-white/[0.05] hover:text-slate-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              {item.icon && (
                <span className="flex-shrink-0 w-4 h-4">
                  {React.isValidElement(item.icon)
                    ? React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, {
                        size: 16,
                      })
                    : item.icon}
                </span>
              )}
              <span className="flex-1 truncate">{item.label}</span>
              {isLocked && <Lock size={14} className="flex-shrink-0 opacity-70" />}
            </motion.button>
          );
        })}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default FloatingSubmenu;
