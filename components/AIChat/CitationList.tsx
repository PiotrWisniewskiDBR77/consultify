/**
 * CitationList
 * 
 * Renders citations from AI responses with links to source data.
 * Follows Perplexity-style inline citation markers [1], [2], etc.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ExternalLink, 
    FileText, 
    Target, 
    Lightbulb, 
    Map, 
    Globe,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { ChatCitation } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface CitationListProps {
    citations: ChatCitation[];
    collapsed?: boolean;
    onToggle?: () => void;
}

const CITATION_ICONS: Record<string, React.ElementType> = {
    assessment: Target,
    initiative: Lightbulb,
    report: FileText,
    roadmap: Map,
    external: Globe
};

const CITATION_COLORS: Record<string, string> = {
    assessment: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    initiative: 'text-green-500 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    report: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    roadmap: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    external: 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
};

export const CitationList: React.FC<CitationListProps> = ({
    citations,
    collapsed = false,
    onToggle
}) => {
    const { t } = useTranslation();
    const { setCurrentView } = useAppStore();

    if (!citations || citations.length === 0) return null;

    const handleCitationClick = (citation: ChatCitation) => {
        // Navigate to source based on type
        switch (citation.type) {
            case 'assessment':
                setCurrentView(AppView.ASSESSMENT_SUMMARY);
                break;
            case 'initiative':
                setCurrentView(AppView.FULL_STEP2_INITIATIVES);
                break;
            case 'report':
                setCurrentView(AppView.FULL_STEP6_REPORTS);
                break;
            case 'roadmap':
                setCurrentView(AppView.FULL_STEP3_ROADMAP);
                break;
            case 'external':
                if (citation.link) {
                    window.open(citation.link, '_blank', 'noopener,noreferrer');
                }
                break;
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
            {/* Header */}
            <button
                onClick={onToggle}
                className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
                <span>{t('aiChat.sources', 'Sources')}</span>
                <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-navy-700 rounded text-[10px]">
                    {citations.length}
                </span>
                {onToggle && (
                    collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                )}
            </button>

            {/* Citations List */}
            {!collapsed && (
                <div className="mt-2 space-y-1.5">
                    {citations.map((citation, index) => {
                        const Icon = CITATION_ICONS[citation.type] || FileText;
                        const colorClass = CITATION_COLORS[citation.type] || CITATION_COLORS.external;

                        return (
                            <button
                                key={citation.id}
                                onClick={() => handleCitationClick(citation)}
                                className={`
                                    w-full flex items-start gap-2 p-2 rounded-lg border text-left
                                    hover:shadow-sm transition-all
                                    ${colorClass}
                                `}
                            >
                                {/* Citation Number */}
                                <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-white dark:bg-navy-900 rounded border border-current">
                                    {index + 1}
                                </span>

                                {/* Icon */}
                                <Icon size={14} className="shrink-0 mt-0.5" />

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-navy-900 dark:text-white truncate">
                                        {citation.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                        {citation.reference}
                                    </div>
                                    {citation.excerpt && (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">
                                            "{citation.excerpt}"
                                        </div>
                                    )}
                                </div>

                                {/* External Link Icon */}
                                <ExternalLink size={12} className="shrink-0 text-slate-400" />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/**
 * Inline citation marker component
 * Renders [1], [2], etc. inline with hover preview
 */
interface CitationMarkerProps {
    number: number;
    citation: ChatCitation;
    onClick?: () => void;
}

export const CitationMarker: React.FC<CitationMarkerProps> = ({
    number,
    citation,
    onClick
}) => {
    const [showTooltip, setShowTooltip] = React.useState(false);
    const Icon = CITATION_ICONS[citation.type] || FileText;

    return (
        <span 
            className="relative inline-flex"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <button
                onClick={onClick}
                className="
                    inline-flex items-center justify-center
                    w-4 h-4 text-[9px] font-bold
                    bg-primary-100 dark:bg-primary-900/40
                    text-primary-700 dark:text-primary-300
                    rounded align-super mx-0.5
                    hover:bg-primary-200 dark:hover:bg-primary-800/50
                    transition-colors cursor-pointer
                "
            >
                {number}
            </button>

            {/* Tooltip */}
            {showTooltip && (
                <div className="
                    absolute left-0 bottom-full mb-1 z-50
                    w-48 p-2
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-700
                    rounded-lg shadow-lg
                    animate-in fade-in-0 zoom-in-95 duration-100
                ">
                    <div className="flex items-start gap-2">
                        <Icon size={14} className="text-primary-500 shrink-0 mt-0.5" />
                        <div>
                            <div className="text-xs font-medium text-navy-900 dark:text-white">
                                {citation.title}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {citation.reference}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </span>
    );
};

export default CitationList;









