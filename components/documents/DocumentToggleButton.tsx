import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import DocumentSidePanel from './DocumentSidePanel';
import { useAIContext } from '../../contexts/AIContext';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

// CSS for the document button (static purple)
const docButtonStyle = `
.doc-btn-gradient {
    background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
}
.doc-btn-gradient:hover {
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.6);
}
`;

export const DocumentToggleButton: React.FC = () => {
    const { toggleSidePanel, activeSidePanel } = useAppStore();
    const { t } = useTranslation();

    // Don't show button if ANY panel is open (cleaner UI)
    if (activeSidePanel !== null) return null;

    return (
        <>
            <style>{docButtonStyle}</style>
            <button
                onClick={() => toggleSidePanel('DOCUMENTS')}
                className="w-10 h-10 flex items-center justify-center text-white rounded-l-2xl rounded-r-none shadow-lg transition-all duration-300 group relative doc-btn-gradient"
                title={t('widgets.documents.title', 'Document Library')}
            >
                <FileText
                    size={18}
                    className="transition-transform group-hover:scale-110"
                />

                {/* Tooltip */}
                <div className={`
                    absolute right-full mr-3 
                    px-3 py-1.5 
                    bg-slate-900 dark:bg-slate-800 
                    text-white text-xs font-medium 
                    rounded-lg
                    whitespace-nowrap
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-200
                    pointer-events-none
                    shadow-lg
                `}>
                    {t('widgets.documents.tooltip', 'Documents')}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
                </div>
            </button>
        </>
    );
};

export default DocumentToggleButton;
