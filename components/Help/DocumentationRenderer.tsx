/**
 * Documentation Renderer Component
 * 
 * Renders help documentation content with proper formatting,
 * table of contents, and rich media support.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileText,
    HelpCircle,
    Video,
    Book,
    CheckCircle,
    Lightbulb,
    AlertCircle,
    ExternalLink,
    Play,
    Clock,
    Users,
    ChevronRight
} from 'lucide-react';
import { MODULE_HELP_CONTENT, HelpModuleId } from '../../config/moduleHelpContent';
import { CARD_DOCS } from '../../config/cardDocumentation';
import { FAQ_CONTENT } from '../../config/faqContent';
import { VIDEO_TUTORIALS } from '../../config/videoTutorialsContent';
import DynamicIcon from '../shared/DynamicIcon';
import HelpFeedbackWidget from './HelpFeedbackWidget';

type ContentType = 'overview' | 'card' | 'faq' | 'video';

interface DocumentationRendererProps {
    moduleId: HelpModuleId;
    contentType: ContentType;
    contentId: string;
    language?: 'en' | 'pl';
    showFeedback?: boolean;
}

export const DocumentationRenderer: React.FC<DocumentationRendererProps> = ({
    moduleId,
    contentType,
    contentId,
    language = 'en',
    showFeedback = true
}) => {
    const { i18n } = useTranslation();
    const lang = language || (i18n.language === 'pl' ? 'pl' : 'en');
    
    // Get content based on type
    const content = useMemo(() => {
        switch (contentType) {
            case 'overview':
                return MODULE_HELP_CONTENT[moduleId];
            case 'card':
                return CARD_DOCS[contentId];
            case 'faq':
                return FAQ_CONTENT.find(f => f.id === contentId);
            case 'video':
                return VIDEO_TUTORIALS.find(v => v.id === contentId);
            default:
                return null;
        }
    }, [contentType, contentId, moduleId]);
    
    if (!content) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                    {lang === 'pl' ? 'Treść nie znaleziona' : 'Content not found'}
                </p>
            </div>
        );
    }
    
    // Render module overview
    if (contentType === 'overview') {
        const module = content as typeof MODULE_HELP_CONTENT[HelpModuleId];
        
        return (
            <article className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <DynamicIcon name={module.icon} size={24} />
                        </div>
                        <h1 className="text-2xl font-bold">{module.name[lang]}</h1>
                    </div>
                    <p className="text-white/90">{module.description[lang]}</p>
                </div>
                
                {/* Content */}
                <div className="p-8 space-y-8">
                    {/* Purpose */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <Lightbulb size={20} className="text-amber-500" />
                            {lang === 'pl' ? 'Cel' : 'Purpose'}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            {module.purpose[lang]}
                        </p>
                    </section>
                    
                    {/* Target Audience */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <Users size={20} className="text-blue-500" />
                            {lang === 'pl' ? 'Dla kogo' : 'Target Audience'}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {module.targetAudience.map((audience, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                                >
                                    {audience}
                                </span>
                            ))}
                        </div>
                    </section>
                    
                    {/* Key Features */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-500" />
                            {lang === 'pl' ? 'Kluczowe funkcje' : 'Key Features'}
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {module.keyFeatures.map((feature, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                        <DynamicIcon name={feature.icon} size={16} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">
                                            {feature.title[lang]}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            {feature.description[lang]}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                    
                    {/* Workflow Steps */}
                    {module.workflowSteps && module.workflowSteps.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <ChevronRight size={20} className="text-indigo-500" />
                                {lang === 'pl' ? 'Kroki pracy' : 'Workflow Steps'}
                            </h2>
                            <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-600" />
                                
                                <div className="space-y-4">
                                    {module.workflowSteps.map((step, i) => (
                                        <div key={i} className="relative flex items-start gap-4 pl-10">
                                            {/* Step number */}
                                            <div className="absolute left-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-900 dark:text-white">
                                                    {step.title[lang]}
                                                </h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                    {step.description[lang]}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}
                    
                    {/* Tips */}
                    <section className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <Lightbulb size={20} />
                            {lang === 'pl' ? 'Wskazówki' : 'Tips'}
                        </h2>
                        <ul className="space-y-2">
                            {module.tips[lang].map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                                    <span className="text-amber-500 mt-0.5">•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </section>
                    
                    {/* Related Modules */}
                    {module.relatedModules && module.relatedModules.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                                {lang === 'pl' ? 'Powiązane moduły' : 'Related Modules'}
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {module.relatedModules.map(relatedId => {
                                    const related = MODULE_HELP_CONTENT[relatedId];
                                    return (
                                        <button
                                            key={relatedId}
                                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                        >
                                            <DynamicIcon name={related.icon} size={16} className="text-slate-600 dark:text-slate-300" />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                                {related.name[lang]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
                
                {/* Feedback */}
                {showFeedback && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-6">
                        <HelpFeedbackWidget contentType="module" contentId={moduleId} />
                    </div>
                )}
            </article>
        );
    }
    
    // Render card documentation
    if (contentType === 'card') {
        const card = content as typeof CARD_DOCS[string];
        
        return (
            <article className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm mb-2">
                        <FileText size={16} />
                        <span>{lang === 'pl' ? 'Dokumentacja' : 'Documentation'}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{card.title}</h1>
                </div>
                
                {/* Content */}
                <div className="p-8 space-y-6">
                    <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
                        {card.description}
                    </p>
                    
                    {/* Features */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                            {lang === 'pl' ? 'Funkcje' : 'Features'}
                        </h2>
                        <ul className="space-y-2">
                            {card.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <CheckCircle size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    
                    {/* How to Use */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                            {lang === 'pl' ? 'Jak używać' : 'How to Use'}
                        </h2>
                        <ol className="space-y-3">
                            {card.howToUse.map((step, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-slate-600 dark:text-slate-300">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                    
                    {/* Tips */}
                    <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <Lightbulb size={18} />
                            {lang === 'pl' ? 'Wskazówki' : 'Tips'}
                        </h3>
                        <ul className="space-y-1">
                            {card.tips.map((tip, i) => (
                                <li key={i} className="text-blue-700 dark:text-blue-300 text-sm flex items-start gap-2">
                                    <span>•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
                
                {/* Feedback */}
                {showFeedback && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-6">
                        <HelpFeedbackWidget contentType="card" contentId={contentId} />
                    </div>
                )}
            </article>
        );
    }
    
    // Render FAQ
    if (contentType === 'faq') {
        const faq = content as typeof FAQ_CONTENT[0];
        
        return (
            <article className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm mb-2">
                        <HelpCircle size={16} />
                        <span>FAQ</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        {lang === 'pl' ? faq.questionPl : faq.question}
                    </h1>
                </div>
                
                {/* Answer */}
                <div className="p-8">
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {lang === 'pl' ? faq.answerPl : faq.answer}
                    </p>
                    
                    {/* Tags */}
                    <div className="mt-6 flex flex-wrap gap-2">
                        {faq.tags.map(tag => (
                            <span
                                key={tag}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
                
                {/* Feedback */}
                {showFeedback && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-6">
                        <HelpFeedbackWidget contentType="faq" contentId={contentId} compact />
                    </div>
                )}
            </article>
        );
    }
    
    // Render Video
    if (contentType === 'video') {
        const video = content as typeof VIDEO_TUTORIALS[0];
        
        return (
            <article className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Video Placeholder */}
                <div className="aspect-video bg-slate-900 flex items-center justify-center">
                    <button className="w-20 h-20 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors">
                        <Play size={32} className="text-slate-900 ml-1" />
                    </button>
                </div>
                
                {/* Info */}
                <div className="p-6">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm mb-2">
                        <Video size={16} />
                        <span>{lang === 'pl' ? 'Wideo' : 'Video'}</span>
                        <span className="text-slate-400">•</span>
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-slate-500">{video.duration}</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        {video.title[lang]}
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-2">
                        {video.description[lang]}
                    </p>
                </div>
                
                {/* Feedback */}
                {showFeedback && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-6">
                        <HelpFeedbackWidget contentType="video" contentId={contentId} compact />
                    </div>
                )}
            </article>
        );
    }
    
    return null;
};

export default DocumentationRenderer;

