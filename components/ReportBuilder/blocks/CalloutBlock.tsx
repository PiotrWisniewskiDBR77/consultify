import React from 'react';
import { ReportBlock, CalloutBlockContent } from '../../../types';
import { AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';

interface CalloutBlockProps {
    block: ReportBlock;
    onUpdate: (updates: Partial<ReportBlock>) => void;
}

export const CalloutBlock: React.FC<CalloutBlockProps> = ({ block, onUpdate }) => {
    const content = block.content as CalloutBlockContent | undefined;
    const level = content?.level || block.level || 'info';
    const text = content?.text || block.message || '';

    const getStyles = () => {
        switch (level) {
            case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200';
            case 'success': return 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-800 dark:text-green-200';
            case 'error': return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-800 dark:text-red-200';
            default: return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200';
        }
    };

    const getIcon = () => {
        switch (level) {
            case 'warning': return <AlertTriangle className="w-5 h-5" />;
            case 'success': return <CheckCircle className="w-5 h-5" />;
            case 'error': return <AlertCircle className="w-5 h-5" />;
            default: return <Info className="w-5 h-5" />;
        }
    };

    const handleChangeText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const updatedContent: CalloutBlockContent = {
            level: level as 'info' | 'warning' | 'success' | 'error',
            text: e.target.value
        };
        onUpdate({ content: updatedContent });
    };

    return (
        <div className={`p-4 rounded-r-lg flex gap-3 ${getStyles()}`}>
            <div className="shrink-0 mt-0.5">{getIcon()}</div>
            <div className="flex-1">
                {block.locked ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                    <textarea
                        value={text}
                        onChange={handleChangeText}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none"
                        placeholder="Enter callout text..."
                        rows={2}
                    />
                )}
            </div>
        </div>
    );
};
