import { Loader2, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { refineContent, RefineContext } from '../../../services/ai/gemini';

interface AITextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onRefine?: () => void;
  aiContext?: RefineContext;
}

export const AITextArea: React.FC<AITextAreaProps> = ({
  className = '',
  onRefine,
  aiContext = 'general',
  ...props
}) => {
  const { t } = useTranslation();
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = async () => {
    if (onRefine) {
      onRefine();
      return;
    }

    const currentText = props.value as string;
    if (!currentText || currentText.length < 3) return;

    setIsRefining(true);
    try {
      const refinedText = await refineContent(currentText, aiContext);

      // Synthetic event to update parent logic
      if (props.onChange) {
        const event = {
          target: { value: refinedText },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        props.onChange(event);
      }
    } catch (error) {
      console.error('Refine failed', error);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="relative group">
      <textarea
        className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400 dark:text-slate-500 pb-10 ${className} ${isRefining ? 'animate-pulse bg-primary-50 dark:bg-primary-900/20' : ''}`}
        value={props.value}
        onChange={props.onChange}
        disabled={isRefining}
        {...props}
      />
      <button
        onClick={handleRefine}
        type="button"
        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm border border-primary-100 dark:border-primary-500/20 hover:border-primary-300 dark:hover:border-primary-500 rounded-full shadow-sm hover:shadow-md transition-all group/btn disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isRefining || !props.value}
      >
        {isRefining ? (
          <Loader2 size={12} className="text-primary-500 animate-spin" />
        ) : (
          <Sparkles
            size={12}
            className="text-primary-500 group-hover/btn:text-primary-600 transition-colors"
          />
        )}
        <span className="text-[10px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-crimson-600 group-hover/btn:from-primary-700 group-hover/btn:to-crimson-700">
          {isRefining ? t('contextBuilder.shared.refining', 'Refining...') : 'AI'}
        </span>
      </button>
    </div>
  );
};
