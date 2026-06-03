import React from 'react';

import { PlaybookNode as PlaybookNodeType, PlaybookNodeType as NodeType } from '../../types';

interface PlaybookPropertiesPanelProps {
  node: PlaybookNodeType | null;
  onUpdate: (updates: Partial<PlaybookNodeType>) => void;
  onClose: () => void;
}

/**
 * PlaybookPropertiesPanel Component
 * Step 13: Visual Playbook Editor
 *
 * Right-side panel for editing selected node properties.
 */
export const PlaybookPropertiesPanel: React.FC<PlaybookPropertiesPanelProps> = ({
  node,
  onUpdate,
  onClose,
}) => {
  if (!node) {
    return (
      <div className="w-80 bg-gray-50 dark:bg-navy-800 border-l border-gray-200 p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Select a node to edit its properties
        </p>
      </div>
    );
  }

  const handleTitleChange = (title: string) => {
    onUpdate({ ...node, title });
  };

  const handleActionTypeChange = (actionType: string) => {
    onUpdate({
      ...node,
      data: { ...node.data, actionType },
    });
  };

  const handleDescriptionChange = (description: string) => {
    onUpdate({
      ...node,
      data: { ...node.data, description },
    });
  };

  const actionTypes = ['TASK_CREATE', 'PLAYBOOK_ASSIGN'];

  return (
    <div className="w-80 bg-white dark:bg-navy-900 border-l border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Node Properties</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-600 dark:text-gray-400"
          >
            ×
          </button>
        </div>
        <div className="mt-1">
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300">
            {node.type}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={node.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={node.type === NodeType.START || node.type === NodeType.END}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100 dark:bg-navy-800"
          />
        </div>

        {/* Action Type (only for ACTION nodes) */}
        {node.type === NodeType.ACTION && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action Type
            </label>
            <select
              value={node.data?.actionType || ''}
              onChange={(e) => handleActionTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">Select action...</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description (for ACTION/BRANCH/CHECK) */}
        {[NodeType.ACTION, NodeType.BRANCH, NodeType.CHECK].includes(node.type) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={node.data?.description || ''}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Describe what this step does..."
            />
          </div>
        )}

        {/* Condition (for BRANCH nodes) */}
        {node.type === NodeType.BRANCH && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Condition
            </label>
            <input
              type="text"
              value={node.data?.condition || ''}
              onChange={(e) =>
                onUpdate({ ...node, data: { ...node.data, condition: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono text-xs"
              placeholder="e.g., metric_lte(help, 0.2)"
            />
          </div>
        )}

        {/* Optional flag */}
        {node.type === NodeType.ACTION && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isOptional"
              checked={node.data?.isOptional || false}
              onChange={(e) =>
                onUpdate({ ...node, data: { ...node.data, isOptional: e.target.checked } })
              }
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="isOptional" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Optional step
            </label>
          </div>
        )}

        {/* Position (read-only info) */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Position: ({Math.round(node.position.x)}, {Math.round(node.position.y)})
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">ID: {node.id}</p>
        </div>
      </div>
    </div>
  );
};

export default PlaybookPropertiesPanel;
