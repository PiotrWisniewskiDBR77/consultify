import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const HubWorkAreaLoading: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const rootClassName = className || 'flex items-center justify-center h-full';
  return (
    <div className={rootClassName} role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
        <span className="text-sm">{t('common.loading', 'Loading...')}</span>
      </div>
    </div>
  );
};
