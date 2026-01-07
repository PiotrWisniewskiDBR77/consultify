/**
 * MoveToProjectModal - Move conversation to project
 */

import React from 'react';

interface Conversation {
    id: string;
    title?: string;
    [key: string]: any;
}

interface MoveToProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    conversationId?: string;
    onMove?: (projectId: string) => void;
}

export const MoveToProjectModal: React.FC<MoveToProjectModalProps> = ({
    isOpen,
    onClose,
    conversation,
    onMove,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-96">
                <h3 className="text-lg font-semibold mb-4">Move to Project</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select a project to move this conversation to.
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveToProjectModal;

