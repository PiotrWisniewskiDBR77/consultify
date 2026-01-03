/**
 * SidebarFooter Component - Apple HIG Design System
 * 
 * Bottom actions including settings and logout.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

interface SidebarFooterProps {
  showFull: boolean;
  onLogout: () => void;
  t: (key: string, fallback?: string) => string;
  children?: React.ReactNode; // For admin/settings menu items
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  showFull,
  onLogout,
  t,
  children,
}) => {
  return (
    <div className="p-3 border-t border-slate-200 dark:border-white/5 shrink-0">
      <div className="space-y-1">
        {/* Separator */}
        <div className="my-1 border-t border-slate-200 dark:border-white/5" />

        {/* Admin/Settings menu items passed as children */}
        {children}

        {/* Logout Button */}
        <motion.button
          onClick={onLogout}
          whileTap={{ scale: 0.98 }}
          className={`
            w-full flex items-center gap-3 py-2.5 rounded-xl
            text-sm font-medium transition-all duration-150
            text-slate-500 dark:text-slate-400 
            hover:bg-danger-50 dark:hover:bg-danger-500/10 
            hover:text-danger-600 dark:hover:text-danger-400
            ${!showFull ? 'justify-center px-0' : 'px-3'}
          `}
          title={t('sidebar.logOut')}
        >
          <LogOut size={18} />
          {showFull && <span>{t('sidebar.logOut')}</span>}
        </motion.button>
      </div>
    </div>
  );
};

export default SidebarFooter;





