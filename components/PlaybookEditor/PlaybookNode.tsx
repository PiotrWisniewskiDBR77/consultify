import React from 'react';
import { PlaybookNode as PlaybookNodeType, PlaybookNodeType as NodeType } from '../../types';
import { Play, Square, GitBranch, CheckCircle, Circle } from 'lucide-react';

interface PlaybookNodeProps {
    node: PlaybookNodeType;
    isSelected: boolean;
    onClick: () => void;
    onDragStart: (e: React.DragEvent) => void;
}

/**
 * PlaybookNode Component
 * Step 13: Visual Playbook Editor
 * 
 * Renders a single node in the playbook canvas.
 */
export const PlaybookNode: React.FC<PlaybookNodeProps> = ({
    node,
    isSelected,
    onClick,
    onDragStart
}) => {
    const getNodeIcon = () => {
        switch (node.type) {
            case NodeType.START:
                return <Play className="w-4 h-4" />;
            case NodeType.END:
                return <Square className="w-4 h-4" />;
            case NodeType.BRANCH:
                return <GitBranch className="w-4 h-4" />;
            case NodeType.CHECK:
                return <CheckCircle className="w-4 h-4" />;
            case NodeType.ACTION:
            default:
                return <Circle className="w-4 h-4" />;
        }
    };

    const getNodeStyles = () => {
        const base = 'absolute rounded-lg shadow-md border-2 cursor-pointer transition-all duration-150';
        const selected = isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : '';

        switch (node.type) {
            case NodeType.START:
                return `${base} ${selected} bg-green-100 border-green-400 text-green-800`;
            case NodeType.END:
                return `${base} ${selected} bg-red-100 border-red-400 text-red-800`;
            case NodeType.BRANCH:
                return `${base} ${selected} bg-yellow-100 border-yellow-400 text-yellow-800`;
            case NodeType.CHECK:
                return `${base} ${selected} bg-blue-100 border-blue-400 text-blue-800`;
            case NodeType.ACTION:
            default:
                return `${base} ${selected} bg-white border-gray-300 text-gray-800`;
        }
    };

    return (
        <div
            className={getNodeStyles()}
            style={{
                left: node.position.x,
                top: node.position.y,
                minWidth: '120px',
                maxWidth: '200px'
            }}
            onClick={onClick}
            draggable
            onDragStart={onDragStart}
        >
            <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                    {getNodeIcon()}
                    <span className="text-sm font-medium truncate">{node.title}</span>
                </div>
                {node.data?.actionType && (
                    <div className="text-xs text-gray-500 mt-1 truncate">
                        {node.data.actionType}
                    </div>
                )}
            </div>

            {/* Connection Points */}
            {node.type !== NodeType.START && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-400 rounded-full border-2 border-white" />
            )}
            {node.type !== NodeType.END && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-400 rounded-full border-2 border-white" />
            )}
        </div>
    );
};

export default PlaybookNode;
