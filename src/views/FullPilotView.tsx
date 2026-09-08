// Pilot View — module in development
// This view will provide pilot program management capabilities

import React from 'react';
import { useTranslation } from 'react-i18next';

export const FullPilotView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-slate-500 dark:text-slate-400">
        <h1 className="text-2xl font-bold mb-2">Pilot View</h1>
        <p>{t('fullPilot.inDevelopment', 'This feature is in development.')}</p>
      </div>
    </div>
  );
};

export default FullPilotView;
