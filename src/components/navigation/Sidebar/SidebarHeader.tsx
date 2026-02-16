/**
 * SidebarHeader Component - Apple HIG Design System
 *
 * Logo and collapse toggle for the sidebar.
 */

import { motion } from 'framer-motion';
import { PanelLeftClose } from 'lucide-react';
import React from 'react';

import { ThemeMode } from './types';

interface SidebarHeaderProps {
  showFull: boolean;
  theme: ThemeMode;
  onToggleCollapse: () => void;
  t: (key: string, fallback?: string) => string;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  showFull,
  theme,
  onToggleCollapse,
  t,
}) => {
  const logoSrc = theme === 'dark' ? '/assets/logos/logo-dark.png' : '/assets/logos/logo-light.png';

  return (
    <div
      className={`
        flex items-center shrink-0 transition-all duration-300
        ${showFull ? 'justify-between px-4 h-16' : 'flex-col justify-center gap-4 py-6'}
      `}
    >
      {showFull ? (
        <>
          {/* Full Logo */}
          <motion.div
            className="flex items-center overflow-hidden flex-1 min-w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <img src={logoSrc} alt="Consultinity" className="max-w-full h-auto object-contain" />
          </motion.div>

          {/* Collapse Button */}
          <motion.button
            type="button"
            onClick={onToggleCollapse}
            whileTap={{ scale: 0.95 }}
            className={`
              p-2 rounded-xl transition-colors duration-150 shrink-0 ml-2
              text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]
            `}
            title={t('sidebar.collapse', 'Collapse')}
          >
            <PanelLeftClose size={20} />
          </motion.button>
        </>
      ) : (
        <>
          {/* Mini Logo (77) */}
          <motion.span
            className="text-2xl font-semibold tracking-tighter text-primary-600 dark:text-primary-400"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            77
          </motion.span>

          {/* Expand Button */}
          <motion.button
            type="button"
            onClick={onToggleCollapse}
            whileTap={{ scale: 0.95 }}
            className={`
              p-2 rounded-xl transition-colors duration-150 flex justify-center items-center
              text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]
            `}
            title={t('sidebar.expand', 'Expand')}
          >
            <PanelLeftClose size={20} className="rotate-180" />
          </motion.button>
        </>
      )}
    </div>
  );
};

export default SidebarHeader;
