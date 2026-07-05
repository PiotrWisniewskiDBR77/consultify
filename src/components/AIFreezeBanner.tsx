import { Cpu, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../store/useAppStore';

export const AIFreezeBanner: React.FC = () => {
  const { t } = useTranslation();
  const { aiFreezeStatus } = useAppStore();

  if (!aiFreezeStatus.isFrozen) return null;

  return (
    <div className="bg-c-warning text-white px-4 py-2 flex items-center justify-between shadow-lg z-toast border-b border-white/20 backdrop-blur-md animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-1.5 rounded-full">
          <ShieldAlert size={18} className="text-white animate-pulse" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-wide">
            {t('aiFreezeBanner.title', 'AI FREEZE ACTIVE:')}
          </span>
          <span className="text-sm ml-2 text-white/90">
            {t(
              'aiFreezeBanner.message',
              'Budget hard limit reached ({{scope}}). AI functionality is temporarily restricted.',
              { scope: aiFreezeStatus.scope || t('aiFreezeBanner.scopeGlobal', 'Global') }
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/10">
          <Cpu size={14} className="text-white/80" />
          <span className="text-[11px] font-medium uppercase tracking-tighter">
            {t('aiFreezeBanner.protocol', 'Budget Control Protocol')}
          </span>
        </div>
        <button
          onClick={() => (window.location.href = '/settings/billing')}
          className="bg-c-surface-raised text-c-warning hover:bg-c-surface px-4 py-1 rounded-lg text-xs font-bold transition-all shadow-sm border border-transparent active:scale-95"
        >
          {t('aiFreezeBanner.increaseBudget', 'Increase Budget')}
        </button>
      </div>
    </div>
  );
};
