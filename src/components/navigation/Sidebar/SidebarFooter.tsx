/**
 * SidebarFooter Component - Apple HIG Design System
 *
 * Bottom actions: children (Organization, Admin, Settings) + Partner Portal + Logout
 */

import { motion } from 'framer-motion';
import { LogOut, Users } from 'lucide-react';
import React from 'react';

import { AppView } from '../../../types';

interface SidebarFooterProps {
  showFull: boolean;
  onLogout: () => void;
  onNavigate: (view: AppView) => void;
  t: (key: string, fallback?: string) => string;
  children?: React.ReactNode;
  showPartnerPortal?: boolean;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  showFull,
  onLogout,
  onNavigate,
  t,
  children,
  showPartnerPortal = true,
}) => {
  return (
    <div className="p-3 mt-2 shrink-0">
      <div className="space-y-1">
        {/* Separator — ultra-subtle */}
        <div className="my-1 border-t border-slate-200/30 dark:border-white/5" />

        {/* Admin/Settings menu items passed as children */}
        {children}

        {/* Partner Portal Button - between Settings and Logout */}
        {showPartnerPortal && (
          <motion.button
            onClick={() => onNavigate(AppView.PARTNER_LANDING)}
            whileTap={{ scale: 0.98 }}
            className={`
                            w-full flex items-center gap-3 py-2.5 rounded-xl
                            text-sm font-medium transition-all duration-150
                            text-slate-600 dark:text-slate-400
                            hover:bg-slate-200/60 dark:hover:bg-white/[0.06]
                            ${!showFull ? 'justify-center px-0' : 'px-3'}
                        `}
            title={t('sidebar.partnerPortal', 'Partner Portal')}
          >
            <Users size={20} />
            {showFull && <span>{t('sidebar.partnerPortal', 'Partner Portal')}</span>}
          </motion.button>
        )}

        {/* Logout Button */}
        <motion.button
          onClick={onLogout}
          whileTap={{ scale: 0.98 }}
          className={`
                        w-full flex items-center gap-3 py-2.5 rounded-xl
                        text-sm font-medium transition-all duration-150
                        text-slate-600 dark:text-slate-400 
                        hover:bg-danger-50/50 dark:hover:bg-danger-500/10
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
