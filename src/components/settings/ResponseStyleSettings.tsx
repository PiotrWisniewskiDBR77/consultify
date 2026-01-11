/**
 * ResponseStyleSettings - AI response style preferences
 */

import { Check, Sliders } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ResponseStyleSettingsProps {
  className?: string;
}

const RESPONSE_LENGTHS = ['concise', 'balanced', 'detailed'] as const;
const TONES = ['professional', 'friendly', 'technical'] as const;

export const ResponseStyleSettings: React.FC<ResponseStyleSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [responseLength, setResponseLength] =
    useState<(typeof RESPONSE_LENGTHS)[number]>('balanced');
  const [tone, setTone] = useState<(typeof TONES)[number]>('professional');

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders size={20} />
          {t('settings.ai.styleTitle', 'Response Style')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.ai.styleDesc', 'Customize how the AI formats and delivers responses.')}
        </p>
      </div>

      {/* Response Length */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t('settings.ai.responseLength', 'Response Length')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {RESPONSE_LENGTHS.map((length) => (
            <button
              key={length}
              onClick={() => setResponseLength(length)}
              className={`p-3 rounded-lg border-2 transition-all ${
                responseLength === length
                  ? 'border-brand bg-brand/5 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-navy-700 hover:border-brand/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-900 dark:text-white capitalize">
                  {t(`settings.ai.length.${length}`, length)}
                </span>
                {responseLength === length && <Check size={16} className="text-brand" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t('settings.ai.tone', 'Tone')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {TONES.map((t_) => (
            <button
              key={t_}
              onClick={() => setTone(t_)}
              className={`p-3 rounded-lg border-2 transition-all ${
                tone === t_
                  ? 'border-brand bg-brand/5 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-navy-700 hover:border-brand/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-900 dark:text-white capitalize">
                  {t(`settings.ai.tone.${t_}`, t_)}
                </span>
                {tone === t_ && <Check size={16} className="text-brand" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResponseStyleSettings;
