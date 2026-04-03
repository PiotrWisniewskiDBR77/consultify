/**
 * AiManageButton
 *
 * Compact "AI Zarządzaj" button used per signal item.
 * Also exported as a larger variant for the global "Zarządzaj wszystkim" button.
 */

import { Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface AiManageButtonProps {
  onClick: () => void;
  variant?: 'inline' | 'global';
  loading?: boolean;
  disabled?: boolean;
}

export const AiManageButton: React.FC<AiManageButtonProps> = ({
  onClick,
  variant = 'inline',
  loading = false,
  disabled = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  if (variant === 'global') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles size={15} className={loading ? 'animate-spin' : ''} />
        {loading
          ? (isPolish ? 'Analizuję...' : 'Analyzing...')
          : (isPolish ? 'AI Zarządzaj wszystkim' : 'AI Manage All')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled || loading}
      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Sparkles size={11} className={loading ? 'animate-spin' : ''} />
      {isPolish ? 'Zarządzaj' : 'Manage'}
    </button>
  );
};

export default AiManageButton;
