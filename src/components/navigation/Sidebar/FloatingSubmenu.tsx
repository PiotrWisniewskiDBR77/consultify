/**
 * FloatingSubmenu Component - Apple HIG Design System
 *
 * A floating submenu that appears next to sidebar items.
 */

import { AnimatePresence, motion } from 'framer-motion';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AppView } from '../../../types';
import { FloatingMenuPosition, MenuItem, ThemeMode } from './types';

interface FloatingSubmenuProps {
  parentRect: DOMRect;
  items: MenuItem[];
  title?: string;
  onClose: () => void;
  onNavigate: (viewId: AppView) => void;
  currentView: AppView;
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
  onNavigate,
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
          fixed z-[9999] w-64 py-2
          rounded-xl
          ${isDark ? 'bg-navy-900 border-white/10' : 'bg-white border-slate-200 dark:border-navy-700'}
          border
          shadow-[0_10px_40px_rgba(0,0,0,0.12)]
          dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]
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
              px-4 py-3 text-sm font-semibold
              ${hasItems ? 'border-b mb-1' : ''} 
              ${isDark ? 'border-white/10 text-white' : 'border-slate-100 dark:border-navy-700 text-navy-900'}
            `}
          >
            {title}
          </div>
        )}

        {/* Menu Items */}
        {items.map((item) => {
          const isActive = item.viewId === currentView;

          return (
            <motion.button
              key={item.id}
              onClick={() => item.viewId && onNavigate(item.viewId)}
              whileTap={{ scale: 0.98 }}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5
                text-sm font-medium text-left
                transition-colors duration-100
                ${
                  isActive
                    ? isDark
                      ? 'bg-primary-900/20 text-primary-300'
                      : 'bg-primary-50 text-primary-600'
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20 dark:hover:bg-navy-800/20 hover:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/20 hover:text-navy-900'
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
            </motion.button>
          );
        })}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default FloatingSubmenu;
