/**
 * AvatarSettings - User avatar management
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Upload, Trash2 } from 'lucide-react';

interface AvatarSettingsProps {
  className?: string;
}

export const AvatarSettings: React.FC<AvatarSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
          {t('settings.avatar.title', 'Profile Photo')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.avatar.description', 'Upload a photo to personalize your profile')}
        </p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-2xl font-medium">
            U
          </div>
          <button className="absolute bottom-0 right-0 p-2 bg-white dark:bg-navy-700 rounded-full shadow-lg border border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-600">
            <Camera size={16} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        <div className="space-y-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors">
            <Upload size={16} />
            {t('settings.avatar.upload', 'Upload Photo')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 size={16} />
            {t('settings.avatar.remove', 'Remove')}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t('settings.avatar.hint', 'Recommended: Square image, at least 200x200px, max 2MB')}
      </p>
    </div>
  );
};

export default AvatarSettings;


