import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const GeneratingStep: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        {t('presentations.generating.title', 'Generating Your Deck')}
      </h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">
        {t(
          'presentations.generating.subtitle',
          'Creating consulting-grade slides with quality validation. This may take a moment...'
        )}
      </p>
      <div className="mt-8 flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
};
