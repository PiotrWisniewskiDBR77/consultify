import React, { useState, useEffect } from 'react';
import { ReportBlock, TextBlockContent } from '../../../types';

interface TextBlockProps {
    block: ReportBlock;
    onUpdate: (updates: Partial<ReportBlock>) => void;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onUpdate }) => {
    const content = block.content as TextBlockContent | undefined;
    const [text, setText] = useState(content?.text || '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const newText = content?.text || '';
        if (text !== newText) setText(newText);
    }, [content?.text]);

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== content?.text) {
            const updatedContent: TextBlockContent = { text };
            onUpdate({ content: updatedContent });
        }
    };

    if (isEditing && !block.locked) {
        return (
            <div className="w-full">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    autoFocus
                    className="w-full min-h-[100px] p-4 bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 resize-none font-serif leading-relaxed text-lg"
                    placeholder="Start typing..."
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => !block.locked && setIsEditing(true)}
            className="w-full min-h-[60px] p-4 text-slate-700 dark:text-slate-200 font-serif leading-relaxed text-lg whitespace-pre-wrap cursor-text"
        >
            {text || <span className="text-slate-400 italic">Empty text block. Click to edit.</span>}
        </div>
    );
};
