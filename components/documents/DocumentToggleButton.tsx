import React, { useState } from 'react';
import { FileText, X } from 'lucide-react';
import DocumentSidePanel from './DocumentSidePanel';
import { useAIContext } from '../../contexts/AIContext';

export const DocumentToggleButton: React.FC = () => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { pmoContext } = useAIContext();
    const projectId = pmoContext?.projectId || undefined;

    return (
        <>
            {/* Toggle Button - Fixed on right side at 25% from top */}
            {!isPanelOpen && (
                <button
                    onClick={() => setIsPanelOpen(true)}
                    className="fixed right-0 top-[25%] z-30 group"
                    title="Biblioteka dokumentów"
                >
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-navy-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 rounded-l-lg border border-r-0 border-slate-200 dark:border-white/10 shadow-sm transition-all">
                        <FileText size={20} />
                    </div>
                </button>
            )}

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
