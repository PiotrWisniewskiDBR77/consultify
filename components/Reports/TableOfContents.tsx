/**
 * TableOfContents
 * 
 * Navigation component for the Report Builder:
 * - Lists all sections with icons
 * - Scroll-to-section on click
 * - Highlights active section using IntersectionObserver
 * - Sticky positioning on desktop
 * - Collapsible on mobile
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronDown,
    ChevronUp,
    List,
    FileText,
    BarChart3,
    BookOpen,
    Target,
    Layers,
    Settings,
    Briefcase,
    Map,
    Package,
    Database,
    Users,
    Shield,
    Brain,
    Cpu,
    CheckCircle,
    Edit3,
    Sparkles
} from 'lucide-react';

interface ReportSectionData {
    id: string;
    sectionType: string;
    axisId?: string;
    title: string;
    isAiGenerated: boolean;
    orderIndex: number;
}

interface TableOfContentsProps {
    sections: ReportSectionData[];
    activeSection: string | null;
    readOnly: boolean;
    onSectionClick: (sectionId: string) => void;
}

// Section type icons
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    cover_page: FileText,
    executive_summary: BarChart3,
    methodology: BookOpen,
    maturity_overview: Target,
    axis_detail: Layers,
    area_detail: Settings,
    gap_analysis: Target,
    initiatives: Briefcase,
    recommendations: Briefcase,
    next_steps: CheckCircle,
    roadmap: Map,
    appendix: FileText,
    custom: FileText
};

// Axis icons
const AXIS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    processes: Cpu,
    digitalProducts: Package,
    businessModels: Briefcase,
    dataManagement: Database,
    culture: Users,
    cybersecurity: Shield,
    aiMaturity: Brain
};

// Section type labels
const SECTION_LABELS: Record<string, { en: string; pl: string }> = {
    cover_page: { en: 'Cover Page', pl: 'Strona Tytułowa' },
    executive_summary: { en: 'Executive Summary', pl: 'Podsumowanie Wykonawcze' },
    methodology: { en: 'Methodology', pl: 'Metodologia' },
    maturity_overview: { en: 'Maturity Overview', pl: 'Przegląd Dojrzałości' },
    axis_detail: { en: 'Axis Detail', pl: 'Szczegóły Osi' },
    gap_analysis: { en: 'Gap Analysis', pl: 'Analiza Luk' },
    recommendations: { en: 'Recommendations', pl: 'Rekomendacje' },
    next_steps: { en: 'Next Steps', pl: 'Następne Kroki' },
    initiatives: { en: 'Initiatives', pl: 'Inicjatywy' },
    roadmap: { en: 'Roadmap', pl: 'Roadmapa' },
    appendix: { en: 'Appendix', pl: 'Załączniki' },
    custom: { en: 'Custom Section', pl: 'Sekcja Niestandardowa' }
};

export const TableOfContents: React.FC<TableOfContentsProps> = ({
    sections,
    activeSection,
    readOnly,
    onSectionClick
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Set up IntersectionObserver for scroll tracking
    useEffect(() => {
        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        // Create new observer
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const sectionId = entry.target.getAttribute('data-section-id');
                    if (sectionId) {
                        setVisibleSections((prev) => {
                            const next = new Set(prev);
                            if (entry.isIntersecting) {
                                next.add(sectionId);
                            } else {
                                next.delete(sectionId);
                            }
                            return next;
                        });
                    }
                });
            },
            {
                root: null,
                rootMargin: '-20% 0px -60% 0px',
                threshold: 0
            }
        );

        // Observe all section elements
        sections.forEach((section) => {
            const element = document.querySelector(`[data-section-id="${section.id}"]`);
            if (element && observerRef.current) {
                observerRef.current.observe(element);
            }
        });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [sections]);

    // Get the first visible section as active (for scroll tracking)
    const scrollActiveSection = sections.find(s => visibleSections.has(s.id))?.id || null;
    const effectiveActiveSection = activeSection || scrollActiveSection;

    // Handle section click
    const handleSectionClick = useCallback((sectionId: string) => {
        onSectionClick(sectionId);
        
        // Scroll to section
        const element = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [onSectionClick]);

    // Get section icon
    const getSectionIcon = (section: ReportSectionData) => {
        if (section.sectionType === 'axis_detail' && section.axisId) {
            return AXIS_ICONS[section.axisId] || Layers;
        }
        return SECTION_ICONS[section.sectionType] || FileText;
    };

    // Get section display title
    const getSectionTitle = (section: ReportSectionData) => {
        // Use custom title if provided
        if (section.title && !SECTION_LABELS[section.sectionType]) {
            return section.title;
        }
        
        // Use translated label for standard sections
        const labels = SECTION_LABELS[section.sectionType];
        if (labels) {
            return isPolish ? labels.pl : labels.en;
        }
        
        return section.title || section.sectionType;
    };

    // Calculate progress (completed sections)
    const completedCount = sections.filter(s => !s.isAiGenerated).length;
    const progress = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-navy-900 dark:text-white text-sm">
                        {t('reports.tableOfContents', 'Table of Contents')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({sections.length})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Progress indicator */}
                    <div className="hidden sm:flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {progress}%
                        </span>
                    </div>
                    {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </button>

            {/* Section list */}
            {!isCollapsed && (
                <nav className="max-h-[60vh] overflow-y-auto">
                    <ul className="py-2">
                        {sections.map((section, index) => {
                            const Icon = getSectionIcon(section);
                            const isActive = effectiveActiveSection === section.id;
                            const title = getSectionTitle(section);

                            return (
                                <li key={section.id}>
                                    <button
                                        onClick={() => handleSectionClick(section.id)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-2 text-left transition-all
                                            ${isActive 
                                                ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-blue-500' 
                                                : 'hover:bg-slate-50 dark:hover:bg-white/5 border-l-2 border-transparent'
                                            }
                                        `}
                                    >
                                        {/* Number */}
                                        <span className={`
                                            flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-medium rounded
                                            ${isActive 
                                                ? 'bg-blue-500 text-white' 
                                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                                            }
                                        `}>
                                            {index + 1}
                                        </span>

                                        {/* Icon */}
                                        <Icon className={`
                                            w-4 h-4 flex-shrink-0
                                            ${isActive 
                                                ? 'text-blue-600 dark:text-blue-400' 
                                                : 'text-slate-400'
                                            }
                                        `} />

                                        {/* Title */}
                                        <span className={`
                                            flex-1 text-sm truncate
                                            ${isActive 
                                                ? 'font-medium text-blue-900 dark:text-blue-100' 
                                                : 'text-slate-700 dark:text-slate-300'
                                            }
                                        `}>
                                            {title}
                                        </span>

                                        {/* AI indicator */}
                                        {section.isAiGenerated ? (
                                            <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                        ) : (
                                            <Edit3 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            )}

            {/* Quick stats (when expanded) */}
            {!isCollapsed && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                <Sparkles className="w-3 h-3" />
                                {sections.filter(s => s.isAiGenerated).length} {t('reports.aiGenerated', 'AI')}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <Edit3 className="w-3 h-3" />
                                {sections.filter(s => !s.isAiGenerated).length} {t('reports.edited', 'edited')}
                            </span>
                        </div>
                        {!readOnly && (
                            <span className="text-slate-500 dark:text-slate-400">
                                {t('reports.clickToNavigate', 'Click to navigate')}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableOfContents;

