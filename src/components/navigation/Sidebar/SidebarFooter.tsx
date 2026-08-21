/**
 * SidebarFooter — Tech Sexy (T102)
 *
 * Bottom actions: children (Organization, Admin, Settings) + Partners + Logout.
 * Monochromatic chrome, invisible border separator.
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
  const btnBase = [
    'w-full flex items-center gap-2.5 py-[7px] rounded-lg',
    'text-[13px] font-medium transition-colors duration-150',
    'text-slate-600 dark:text-slate-300',
    showFull ? 'px-2.5' : 'px-0 justify-center',
  ].join(' ');

  return (
    <div className="px-3 pb-3 pt-1 shrink-0">
      <div className="space-y-0.5">
        <div className="mb-1 h-px bg-white/[0.06]" />

        {children}

        {showPartnerPortal && (
          <motion.button
            type="button"
            onClick={() => onNavigate(AppView.PARTNER_LANDING)}
            whileTap={{ scale: 0.98 }}
            className={`${btnBase} hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-300`}
            title={t('sidebar.partnerPortal', 'Partners')}
          >
            <Users size={18} strokeWidth={1.75} className="shrink-0" />
            {showFull && <span>{t('sidebar.partnerPortal', 'Partners')}</span>}
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={onLogout}
          whileTap={{ scale: 0.98 }}
          className={`${btnBase} hover:bg-danger-500/10 hover:text-danger-400`}
          title={t('sidebar.logOut')}
          aria-label={t('sidebar.logOut', 'Log out')}
        >
          <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
          {showFull && <span>{t('sidebar.logOut')}</span>}
        </motion.button>
      </div>
    </div>
  );
};

export default SidebarFooter;
