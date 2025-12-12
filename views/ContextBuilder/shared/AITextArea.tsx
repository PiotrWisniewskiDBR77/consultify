import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { refineContent, RefineContext } from '../../../services/ai/gemini';

interface AITextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onRefine?: () => void;
    aiContext?: RefineContext;
}

export const AITextArea: React.FC<AITextAreaProps> = ({ className = '', onRefine, aiContext = 'general', ...props }) => {
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
                    target: { value: refinedText }
                } as React.ChangeEvent<HTMLTextAreaElement>;
                props.onChange(event);
            }
        } catch (error) {
            console.error("Refine failed", error);
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="relative group">
            <textarea
                className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900/50 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all placeholder:text-slate-400 pb-10 ${className} ${isRefining ? 'animate-pulse bg-purple-50 dark:bg-purple-900/20' : ''}`}
                value={props.value}
                onChange={props.onChange}
                disabled={isRefining}
                {...props}
            />
            <button
                onClick={handleRefine}
                type="button"
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm border border-purple-100 dark:border-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500 rounded-full shadow-sm hover:shadow-md transition-all group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isRefining || !props.value}
            >
                {isRefining ? (
                    <Loader2 size={12} className="text-purple-500 animate-spin" />
                ) : (
                    <Sparkles size={12} className="text-purple-500 group-hover/btn:text-purple-600 transition-colors" />
                )}
                <span className="text-[10px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 group-hover/btn:from-purple-700 group-hover/btn:to-indigo-700">
                    {isRefining ? 'Refining...' : 'AI'}
                </span>
            </button>
        </div>
    );
};
