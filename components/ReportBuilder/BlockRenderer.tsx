import React from 'react';
import { ReportBlock, BlockType } from '../../types';
import { GripVertical, Lock, Unlock, Wand2, Trash2 } from 'lucide-react';
import { TextBlock } from './blocks/TextBlock';
import { CalloutBlock } from './blocks/CalloutBlock';

interface BlockRendererProps {
    block: ReportBlock;
    onUpdate: (updates: Partial<ReportBlock>) => void;
    onRegenerate: (instructions?: string) => void;
    onDelete: () => void;
    dragHandleProps?: any;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ block, onUpdate, onRegenerate, onDelete, dragHandleProps }) => {

    const renderContent = () => {
        switch (block.type) {
            case 'text':
                return <TextBlock block={block} onUpdate={onUpdate} />;
            case 'callout':
                return <CalloutBlock block={block} onUpdate={onUpdate} />;
            default:
                return <div className="p-4 text-gray-400 italic">Unsupported block type: {block.type}</div>;
        }
    };

    const handleAiClick = () => {
        // Simple prompt for MVP
        const instructions = window.prompt("Enter instructions for AI regeneration (e.g., 'Make it shorter'):");
        if (instructions !== null) {
            onRegenerate(instructions);
        }
    };

    return (
        <div className={`group relative bg-white dark:bg-navy-800 rounded-xl border transition-all ${block.locked ? 'border-amber-200 dark:border-amber-900/30' : 'border-slate-200 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-500/30'
            } shadow-sm`}>

            {/* Block Header / Controls - Visible on Hover */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-navy-800/80 p-1 rounded backdrop-blur z-10">

                {/* Toggle Lock */}
                <button
                    onClick={() => onUpdate({ locked: !block.locked })}
                    className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 ${block.locked ? 'text-amber-500' : 'text-slate-400'}`}
                    title={block.locked ? "Unlock" : "Lock"}
                >
                    {block.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>

                {!block.locked && (
                    <>
                        {/* AI Action */}
                        <button
                            onClick={handleAiClick}
                            className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-500"
                            title="AI Rewrite"
                        >
                            <Wand2 size={14} />
                        </button>

                        {/* Delete */}
                        <button
                            onClick={onDelete}
                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </>
                )}
            </div>

            {/* Drag Handle */}
            {!block.locked && (
                <div
                    {...dragHandleProps}
                    className="absolute top-1/2 -translate-y-1/2 -left-3 p-1.5 text-slate-300 hover:text-slate-500 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <GripVertical size={16} />
                </div>
            )}

            {/* Content Area */}
            <div className="p-1">
                {renderContent()}
            </div>
        </div>
    );
};
