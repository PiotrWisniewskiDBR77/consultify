import React, { useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import DocumentSidePanel from './DocumentSidePanel';
import { useAIContext } from '../../contexts/AIContext';

export const DocumentToggleButton: React.FC = () => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { pmoContext } = useAIContext();
    const projectId = pmoContext?.projectId || undefined;

    return (
        <>
            {/* Toggle Button - Fixed on right side */}
            <button
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className={`fixed right-0 top-1/2 -translate-y-1/2 z-30 transition-all duration-200 ${isPanelOpen ? 'right-80' : 'right-0'
                    }`}
            >
                <div className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-3 rounded-l-lg shadow-lg transition-colors">
                    {isPanelOpen ? (
                        <X size={18} />
                    ) : (
                        <>
                            <FolderOpen size={18} />
                            <span className="text-xs font-medium writing-mode-vertical transform rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                Dokumenty
                            </span>
                        </>
                    )}
                </div>
            </button>

            {/* Side Panel */}
            <DocumentSidePanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                projectId={projectId}
            />
        </>
    );
};

export default DocumentToggleButton;
