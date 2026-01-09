/**
 * Document Toggle Button
 *
 * Modern floating button that toggles the DocumentSidePanel.
 * Glass morphism design with cool cyan/teal glow.
 */

import { FileText } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

export const DocumentToggleButton: React.FC = () => {
    const { toggleSidePanel, activeSidePanel } = useAppStore();
    const { t } = useTranslation();

    // Don't show button if ANY panel is open
    if (activeSidePanel !== null) return null;

    return (
        <button
            onClick={() => toggleSidePanel('DOCUMENTS')}
            className="
                group relative
                w-11 h-11 
                flex items-center justify-center 
                rounded-l-xl rounded-r-none
                bg-gradient-to-br from-cyan-500 to-teal-600
                hover:from-cyan-400 hover:to-teal-500
                text-white
                shadow-lg shadow-cyan-500/30
                hover:shadow-xl hover:shadow-cyan-500/40
                hover:scale-105
                active:scale-95
                transition-all duration-200
                border border-white/20
                backdrop-blur-sm
            "
            title={t('widgets.documents.title', 'Document Library')}
            aria-label={t('widgets.documents.title', 'Documents')}
        >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-l-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            
            <FileText size={20} className="relative z-10 transition-transform duration-200 group-hover:scale-110" />

            {/* Tooltip */}
            <div className="
                absolute right-full mr-3 
                px-3 py-2 
                bg-navy-900/95 dark:bg-slate-800/95
                backdrop-blur-sm
                text-white text-xs font-medium 
                rounded-lg
                whitespace-nowrap
                opacity-0 group-hover:opacity-100
                translate-x-2 group-hover:translate-x-0
                transition-all duration-200
                pointer-events-none
                shadow-xl
                border border-white/10
            ">
                {t('widgets.documents.tooltip', 'Documents')}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[5px] w-2 h-2 bg-navy-900/95 dark:bg-slate-800/95 rotate-45 border-r border-t border-white/10" />
            </div>
        </button>
    );
};

export default DocumentToggleButton;
