import React from 'react';
import { PlaybookNodeType } from '../../types';
import { Plus, Play, Square, GitBranch, CheckCircle, Circle, Save, AlertCircle, Trash2 } from 'lucide-react';

interface PlaybookToolbarProps {
    onAddNode: (type: PlaybookNodeType) => void;
    onSave: () => void;
    onValidate: () => void;
    onDeleteSelected: () => void;
    hasSelectedNode: boolean;
    isSaving: boolean;
    isValidating: boolean;
    isDirty: boolean;
}

/**
 * PlaybookToolbar Component
 * Step 13: Visual Playbook Editor
 * 
 * Top toolbar with add node, save, and validate actions.
 */
export const PlaybookToolbar: React.FC<PlaybookToolbarProps> = ({
    onAddNode,
    onSave,
    onValidate,
    onDeleteSelected,
    hasSelectedNode,
    isSaving,
    isValidating,
    isDirty
}) => {
    const nodeTypes = [
        { type: PlaybookNodeType.ACTION, icon: Circle, label: 'Action', color: 'text-gray-600' },
        { type: PlaybookNodeType.BRANCH, icon: GitBranch, label: 'Branch', color: 'text-yellow-600' },
        { type: PlaybookNodeType.CHECK, icon: CheckCircle, label: 'Check', color: 'text-blue-600' },
    ];

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Left: Add Nodes */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">Add:</span>
                {nodeTypes.map(({ type, icon: Icon, label, color }) => (
                    <button
                        key={type}
                        onClick={() => onAddNode(type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition ${color}`}
                        title={`Add ${label} node`}
                    >
                        <Icon size={14} />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Delete Selected */}
                {hasSelectedNode && (
                    <button
                        onClick={onDeleteSelected}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                        title="Delete selected node"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                )}

                {/* Validate */}
                <button
                    onClick={onValidate}
                    disabled={isValidating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                >
                    <AlertCircle size={14} />
                    {isValidating ? 'Validating...' : 'Validate'}
                </button>

                {/* Save */}
                <button
                    onClick={onSave}
                    disabled={isSaving || !isDirty}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                    <Save size={14} />
                    {isSaving ? 'Saving...' : 'Save Draft'}
                </button>
            </div>
        </div>
    );
};

export default PlaybookToolbar;
