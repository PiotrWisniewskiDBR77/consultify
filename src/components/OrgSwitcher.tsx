/**
 * OrgSwitcher - Component for switching between organizations
 *
 * Features:
 * - Dropdown showing available orgs
 * - Visual indicator for current org
 * - Role badges (OWNER, ADMIN, MEMBER, CONSULTANT)
 * - Loading / switching states
 * - Hidden when only one org available
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Organization, useOrgContext } from '@/contexts/OrgContext';

interface OrgSwitcherProps {
  className?: string;
  compact?: boolean;
}

const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'OWNER':
      return 'bg-primary-500/20 text-primary-400 dark:text-primary-300 border-primary-500/30';
    case 'ADMIN':
      return 'bg-blue-500/20 text-blue-400 dark:text-blue-300 border-blue-500/30';
    case 'MEMBER':
      return 'bg-green-500/20 text-green-400 dark:text-green-300 border-green-500/30';
    case 'CONSULTANT':
      return 'bg-amber-500/20 text-amber-400 dark:text-amber-300 border-amber-500/30';
    default:
      return 'bg-gray-500/20 text-gray-600 dark:text-gray-300 border-gray-500/30';
  }
};

const getRoleLabel = (role: string, accessType?: string): string => {
  if (accessType === 'CONSULTANT') return 'C';
  return role.charAt(0);
};

const OrgSwitcher: React.FC<OrgSwitcherProps> = ({ className = '', compact = false }) => {
  const { t } = useTranslation();
  const { currentOrg, availableOrgs, isLoading, isSwitching, switchOrg } = useOrgContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isOpen]);

  if (!isLoading && availableOrgs.length <= 1) {
    if (compact) return null;
    const singleOrg = availableOrgs[0];
    if (!singleOrg) return null;
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 ${className}`}>
        <Building2 size={14} className="text-slate-600 dark:text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {singleOrg.name}
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`px-3 py-2 ${className}`}>
        <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-8 rounded-lg" />
      </div>
    );
  }

  const handleSelect = (org: Organization) => {
    if (org.id === currentOrg?.id || isSwitching) return;
    switchOrg(org.id);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !isSwitching && setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                   bg-white/50 dark:bg-slate-800/50
                   hover:bg-white/80 dark:hover:bg-slate-700/50
                   border border-slate-200 dark:border-slate-700
                   transition-colors w-full group disabled:opacity-70"
      >
        <Building2 size={14} className="text-slate-600 dark:text-slate-500 shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
            {currentOrg?.name || t('common.selectOrganization', 'Select Organization')}
          </div>
        </div>
        {isSwitching ? (
          <Loader2 size={14} className="animate-spin text-primary-500 shrink-0" />
        ) : (
          <ChevronDown
            size={14}
            className={`text-slate-600 dark:text-slate-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full min-w-[220px]
                       bg-white dark:bg-slate-800
                       border border-slate-200 dark:border-slate-700
                       rounded-lg shadow-lg overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-500">
                {t('common.organizations', 'Organizations')}
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {availableOrgs.map((org) => {
                const isCurrent = org.id === currentOrg?.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelect(org)}
                    disabled={isSwitching}
                    className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2
                      hover:bg-slate-50 dark:hover:bg-slate-700/50
                      ${isCurrent ? 'bg-slate-100/70 dark:bg-white/[0.06]' : ''}
                      disabled:opacity-50`}
                  >
                    <div className="w-4 shrink-0 flex items-center justify-center">
                      {isCurrent && (
                        <Check size={14} className="text-slate-700 dark:text-slate-200" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm truncate ${isCurrent ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {org.name}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getRoleBadgeColor(org.role)}`}
                    >
                      {getRoleLabel(org.role, org.access_type)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrgSwitcher;
