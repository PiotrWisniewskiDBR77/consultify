import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import DocumentSidePanel from './DocumentSidePanel';
import { useAIContext } from '../../contexts/AIContext';
import { useTranslation } from 'react-i18next';

// CSS for the document button color animation (purple -> blue, matching help buttons)
const docAnimationStyle = `
@keyframes docColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
    }
    50% {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }
}

@keyframes docIconGlow {
    0%, 100% { 
        filter: drop-shadow(0 0 1px rgba(255,255,255,0.3));
    }
    50% { 
        filter: drop-shadow(0 0 5px rgba(255,255,255,0.6));
    }
}
`;

export const DocumentToggleButton: React.FC = () => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { pmoContext } = useAIContext();
    const { i18n } = useTranslation();
    const projectId = pmoContext?.projectId || undefined;
    const lang = i18n.language === 'pl' ? 'pl' : 'en';

    return (
        <>
            <style>{docAnimationStyle}</style>
            {/* Toggle Button */}
            {!isPanelOpen && (
                <button
                    onClick={() => setIsPanelOpen(true)}
                    className="w-12 h-12 flex items-center justify-center text-white rounded-l-2xl rounded-r-none shadow-lg transition-all duration-300 group relative"
                    style={{
                        animation: 'docColorPulse 5s ease-in-out infinite',
                    }}
                    title={lang === 'pl' ? 'Biblioteka dokumentów' : 'Document Library'}
                >
                    <FileText
                        size={20}
                        className="transition-transform"
                        style={{ animation: 'docIconGlow 5s ease-in-out infinite' }}
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
                        {lang === 'pl' ? 'Dokumenty' : 'Documents'}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
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
